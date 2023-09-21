import { getNetwork } from './network.js';
import { getBalance, isMasternodeUTXO, getStakingBalance } from './global.js';
import { sleep } from './misc.js';
import { debug } from './settings.js';
import { getEventEmitter } from './event_bus.js';
import Multimap from 'multimap';
import { UTXO_WALLET_STATE, wallet } from './wallet.js';
import { COIN } from './chain_params.js';

export class CTxOut {
    /**
     * @param {Object} CTxOut
     * @param {Number} CTxOut.n - Position inside the transaction
     * @param {String} CTxOut.script - Reedem script, in hex
     * @param {Number} CTxOut.value - Value in satoshi
     */
    constructor({ n, script, value } = {}) {
        /** Position inside the transaction
         *  @type {Number} */
        this.n = n;
        /** Reedem script, in hex
         * @type {String} */
        this.script = script;
        /** Value in satoshi
         *  @type {Number} */
        this.value = value;
    }
}
export class CTxIn {
    /**
     * @param {Object} CTxIn
     * @param {COutpoint} CTxIn.outpoint - Outpoint of the UTXO that the vin spends
     * @param {String} CTxIn.scriptSig - Script used to spend the corresponding UTXO, in hex
     */
    constructor({ outpoint, scriptSig } = {}) {
        /** Outpoint of the UTXO that the vin spends
         *  @type {COutpoint} */
        this.outpoint = outpoint;
        /** Script used to spend the corresponding UTXO, in hex
         * @type {String} */
        this.scriptSig = scriptSig;
    }
}

export class Transaction {
    /**
     * @param {Object} Transaction
     * @param {String} Transaction.txid - Transaction ID
     * @param {Number} Transaction.blockHeight - Block height of the transaction (-1 if is pending)
     * @param {Array<CTxIn>} Transaction.vin - Inputs of the transaction
     * @param {Array<CTxOut>} Transaction.vout - Outputs of the transaction
     */
    constructor({ txid, blockHeight, vin, vout } = {}) {
        /** Transaction ID
         * @type {String} */
        this.txid = txid;
        /** Block height of the transaction (-1 if is pending)
         * @param {Number} */
        this.blockHeight = blockHeight;
        /** Outputs of the transaction
         *  @type {Array<CTxIn>}*/
        this.vin = vin;
        /** Outputs of the transaction
         *  @type {Array<CTxOut>}*/
        this.vout = vout;
    }
    isConfirmed() {
        return this.blockHeight != -1;
    }
}
/** An Unspent Transaction Output, used as Inputs of future transactions */
export class COutpoint {
    /**
     * @param {Object} COutpoint
     * @param {String} COutpoint.txid - Transaction ID
     * @param {Number} COutpoint.n - Outpoint position in the corresponding transaction
     */
    constructor({ txid, n } = {}) {
        /** Transaction ID
         * @type {String} */
        this.txid = txid;
        /** Outpoint position in the corresponding transaction
         *  @type {Number} */
        this.n = n;
    }
}

/** An Unspent Transaction Output, used as Inputs of future transactions */
export class UTXO {
    /**
     * @param {Object} UTXO
     * @param {String} UTXO.id - Transaction ID
     * @param {String} UTXO.path - If applicable, the HD Path of the owning address
     * @param {Number} UTXO.sats - Satoshi value in this UTXO
     * @param {String} UTXO.script - HEX encoded spending script
     * @param {Number} UTXO.vout - Output position of this transaction
     * @param {Number} UTXO.height - Block height of the UTXO
     * @param {Number} UTXO.status - UTXO status enum state
     * @param {boolean} UTXO.isDelegate - Whether the UTXO is a cold stake delegation
     * @param {boolean} UTXO.isReward - Whether the UTXO is a reward
     */
    constructor({
        id,
        path,
        sats,
        script,
        vout,
        height,
        status,
        isDelegate = false,
        isReward = false,
    } = {}) {
        /** Transaction ID
         * @type {String} */
        this.id = id;

        /** HD Path of the owning address
         *  @type {String} */
        this.path = path;

        /** Satoshi value in this UTXO
         *  @type {Number} */
        this.sats = sats;

        /** HEX encoded spending script
         *  @type {String} */
        this.script = script;

        /** Output position of this transaction
         *  @type {Number} */
        this.vout = vout;

        /** Block height of the UTXO
         *  @type {Number} */
        this.height = height;

        /** UTXO status enum state
         *  @type {Number} */
        this.status = status;

        /** Whether it's a delegation UTXO
         * @type {boolean} */
        this.isDelegate = isDelegate;

        /** Whether it's a reward UTXO
         * @type {boolean} */
        this.isReward = isReward;
    }

    /**
     * Check for equality between this UTXO and another UTXO
     * @param {UTXO} cUTXO - UTXO to compare against
     * @returns {Boolean} `true` if equal, `false` if unequal
     */
    equalsUTXO(cUTXO) {
        return (
            this.id === cUTXO.id &&
            this.vout === cUTXO.vout &&
            this.status === cUTXO.status
        );
    }
}

/** A Mempool instance, stores and handles UTXO data for the wallet */
export class Mempool {
    /**
     * @type {boolean}
     */
    #isLoaded = false;
    #balance = 0;
    #coldBalance = 0;
    constructor() {
        /**
         * Multimap txid -> spent Coutpoint
         * @type {Multimap<String, COutpoint>}
         */
        this.spent = new Multimap();
        /**
         * An array of all known UTXOs
         * @type {Array<UTXO>}
         */
        this.UTXOs = [];
        /**
         * A map of all known transactions
         * @type {Map<String, Transaction>}
         */
        this.txmap = new Map();
        this.subscribeToNetwork();
    }

    reset() {
        this.UTXOs = [];
        this.#isLoaded = false;
        this.txmap = new Map();
        this.spent = new Multimap();
    }
    get balance() {
        return this.#balance;
    }
    get coldBalance() {
        return this.#coldBalance;
    }
    get isLoaded() {
        return this.#isLoaded;
    }

    /** The CONFIRMED state (UTXO is spendable) */
    static CONFIRMED = 0;

    /** The REMOVED state (UTXO was spent and will be removed soon) */
    static REMOVED = 1;

    /** The PENDING state (standard UTXO is in mempool, pending confirmation) */
    static PENDING = 2;

    /**
     * Remove a UTXO after a set amount of time
     * @param {Number} nBlocks - Estimated blocks to wait
     * @param {UTXO} cUTXO - UTXO to remove
     */
    async removeWithDelay(nBlocks, cUTXO) {
        await sleep(nBlocks * 60 * 1000);
        this.removeUTXO(cUTXO);
    }

    /**
     * Check if an exact UTXO match can be found in our wallet
     * @param {Object} UTXO
     * @param {String} UTXO.id - Transaction ID
     * @param {Number} UTXO.vout - Output position of this transaction
     * @param {Number} [UTXO.status] - UTXO status enum state. If it's undefined, it will ignore it.
     * @returns {Boolean} `true` or `false`
     */
    isAlreadyStored({ id, vout, status }) {
        return this.UTXOs.some(
            (cUTXO) =>
                cUTXO.id === id &&
                cUTXO.vout === vout &&
                (!status || cUTXO.status === status)
        );
    }

    /**
     * Fetches an array of UTXOs filtered by their state
     * @param {Number} nState - Specific UTXO state
     * @returns {Array<UTXO>} `array` - An array of UTXOs
     */
    getUTXOsByState(nState) {
        return this.UTXOs.filter((cUTXO) => cUTXO.status === nState);
    }

    /**
     * Removes a UTXO from a specific state
     * @param {UTXO} cNewUTXO - Pending UTXO to remove
     * @param {Number} nState - Specific state of this UTXO to search for
     */
    removeFromState(cNewUTXO, nState) {
        const arrPendingUTXOs = this.getUTXOsByState(nState);
        // Loop each pending UTXO
        for (const cUTXO of arrPendingUTXOs) {
            // Search for matching ID + output number
            if (cUTXO.id === cNewUTXO.id && cUTXO.vout === cNewUTXO.vout) {
                // Nuke it from orbit
                this.removeUTXO(cUTXO);
                break;
            }
        }
    }

    /**
     * Add a new UTXO to the wallet
     * @param {UTXO} UTXO
     */
    addUTXO({
        id,
        path,
        sats,
        script,
        vout,
        height,
        status,
        isDelegate,
        isReward,
    }) {
        const newUTXO = new UTXO({
            id,
            path,
            sats,
            script,
            vout,
            height,
            status,
            isDelegate,
            isReward,
        });

        if (this.isAlreadyStored({ id, vout })) {
            this.updateUTXO({ id, vout });
        } else {
            this.UTXOs.push(newUTXO);
        }

        // Re-render the Balance UIs
        //getBalance(true);
        //getStakingBalance(true);
    }

    /**
     * Update an existing UTXO, by confirming its pending status
     * The UTXO must be in
     * @param {Object} UTXO - Object to be deconstructed
     * @param {String} UTXO.id - Transaction id
     * @param {Number} UTXO.vout - vout
     */
    updateUTXO({ id, vout }) {
        if (debug) {
            console.assert(
                this.isAlreadyStored({ id, vout }),
                'Debug Mode: updateUTXO must be called with an existing UTXO'
            );
        }
        const cUTXO = this.UTXOs.find(
            (utxo) => utxo.id === id && utxo.vout == vout
        );
        switch (cUTXO.status) {
            case Mempool.PENDING:
                cUTXO.status = Mempool.CONFIRMED;
                break;
        }
        //getBalance(true);
        //getStakingBalance(true);
    }

    /**
     * Remove a UTXO completely from our wallet
     * @param {UTXO} cUTXO - UTXO to remove
     */
    removeUTXO(cUTXO) {
        this.UTXOs = this.UTXOs.filter((utxo) => !utxo.equalsUTXO(cUTXO));
    }

    /**
     * Remove a UTXO completely from our wallet, with a 12 minute delay given his id, path and vout
     * @param {Object} UTXO
     * @param {String} UTXO.id - Transaction ID
     * @param {Number} UTXO.vout - Output position of this transaction
     */
    autoRemoveUTXO({ id, vout }) {
        for (const cUTXO of this.UTXOs) {
            // Loop given + internal UTXOs to find a match, then start the delayed removal
            if (
                cUTXO.id === id &&
                cUTXO.vout === vout &&
                cUTXO.status != Mempool.REMOVED
            ) {
                cUTXO.status = Mempool.REMOVED;
                this.removeWithDelay(12, cUTXO);
                return;
            }
        }
        console.error(
            'Mempool: Failed to find UTXO ' +
                id +
                ' (' +
                vout +
                ') for auto-removal!'
        );
    }

    /**
     * Remove many UTXOs completely from our wallet, with a 12 minute delay
     * @param {Array<UTXO>} arrUTXOs - UTXOs to remove
     */
    autoRemoveUTXOs(arrUTXOs) {
        for (const cNewUTXO of arrUTXOs) {
            for (const cUTXO of this.UTXOs) {
                // Loop given + internal UTXOs to find a match, then start the delayed removal
                if (cUTXO.equalsUTXO(cNewUTXO)) {
                    cUTXO.status = Mempool.REMOVED;
                    this.removeWithDelay(12, cUTXO);
                    break;
                }
            }
        }
    }

    /**
     * Fetches an array of confirmed UTXOs, an easier alias to {@link getUTXOsByState}
     * @returns {Array<UTXO>} `array` - An array of UTXOs
     */
    getConfirmed() {
        return this.getUTXOsByState(Mempool.CONFIRMED);
    }

    /**
     * Get standard, non delegated, UTXOs
     * @returns {Array<UTXO>} Non delegated utxos
     */
    getStandardUTXOs() {
        return this.UTXOs.filter(
            (cUTXO) => cUTXO.status !== Mempool.REMOVED && !cUTXO.isDelegate
        );
    }

    /**
     * Get delegated UTXOs
     * @returns {Array<UTXO>} Delegated UTXOs
     */
    getDelegatedUTXOs() {
        return this.UTXOs.filter(
            (cUTXO) => cUTXO.status !== Mempool.REMOVED && cUTXO.isDelegate
        );
    }

    /**
     * Returns the real-time balance of the wallet (all addresses)
     * @returns {Number} Balance in satoshis
     */
    getBalance() {
        // Fetch 'standard' balances: the sum of all Confirmed or Unconfirmed transactions (excluding Masternode collaterals)
        return this.getStandardUTXOs()
            .filter((cUTXO) => !isMasternodeUTXO(cUTXO)) // TODO: add masternode
            .reduce((a, b) => a + b.sats, 0);
    }

    /**
     * Returns if a UTXO is valid
     * @param {UTXO} cUTXO - UTXO
     * @returns {Boolean} `true` if the reward UTXO is spendable, `false` if not
     */
    static isValidUTXO(cUTXO) {
        if (cUTXO.isReward) {
            return getNetwork().cachedBlockCount - cUTXO.height > 100;
        } else {
            return true;
        }
    }

    /**
     * Returns the real-time delegated balance of the wallet (all addresses)
     * @returns {Number} Delegated balance in satoshis
     */
    getDelegatedBalance() {
        return this.getDelegatedUTXOs().reduce((a, b) => a + b.sats, 0);
    }

    /**
     * Subscribes to network events
     * @param {Network} network
     */
    subscribeToNetwork() {
        getEventEmitter().on('utxo', async (utxos) => {
            //Should not really happen
            if (this.#isLoaded && this.UTXOs.length != 0) {
                console.log(
                    'ERROR! Event UTXO called on already loaded mempool'
                );
                return;
            }
            for (const utxo of utxos) {
                // If we have the UTXO, we update it's confirmation status
                if (this.isAlreadyStored({ id: utxo.txid, vout: utxo.vout })) {
                    this.updateUTXO({ id: utxo.txid, vout: utxo.vout });
                    continue;
                }
                // If the UTXO is new, we'll process it and add it internally
                const tx = await getNetwork().getTxFullInfo(utxo.txid);
                this.addUTXO(await getNetwork().getUTXOFullInfo(utxo));
                this.txmap.set(tx.txid, this.parseTransaction(tx));
                //Little hack: sadly we don't have ALL the wallet txs
                //So what we do: we put in spent state all the vouts that are not in the currrent utxos list.
                for (const vout of tx.vout) {
                    const op = new COutpoint({ txid: tx.txid, n: vout.n });
                    const isMyUTXO = utxos.some(
                        (x) => x.txid == op.txid && x.vout == op.n
                    );
                    if (!isMyUTXO && !this.isSpent(op)) {
                        this.spent.set(tx.txid, op);
                    }
                }
            }
            console.log(this.txmap);
            console.log(this.UTXOs);
            for (let u of this.UTXOs) {
                console.log(u.id, u.vout, u.sats / COIN);
            }
            console.log(this.spent);
            this.#isLoaded = true;
            this.#balance = await this.getBalanceNew(
                UTXO_WALLET_STATE.SPENDABLE
            );
            this.#coldBalance = await this.getBalanceNew(
                UTXO_WALLET_STATE.SPENDABLE_COLD
            );
        });
        getEventEmitter().on('recent_txs', async (txs) => {
            // Don't process recent_txs if mempool is not loaded yet
            if (!this.#isLoaded) {
                return;
            }
            for (const tx of txs) {
                if (
                    !this.txmap.has(tx.txid) ||
                    !this.txmap.get(tx.txid).isConfirmed()
                ) {
                    const fullTx = this.parseTransaction(
                        await getNetwork().getTxFullInfo(tx.txid)
                    );
                    await this.updateMempool(fullTx);
                }
            }
            console.log('txmap', this.txmap);
            console.log('spent', this.spent);
        });
    }
    /**
     * An Outpoint to check
     * @param {COutpoint} op
     */
    isSpent(op) {
        return this.spent.get(op.txid)?.some((x) => x.n == op.n);
    }

    /**
     * Get the total wallet balance
     */
    async getBalanceNew(filter) {
        let totBalance = 0;
        for (let [txid, tx] of this.txmap) {
            for (let vout of tx.vout) {
                const op = new COutpoint({ txid: txid, n: vout.n });
                if (this.isSpent(op)) {
                    continue;
                }
                const [UTXO_STATE, _] = await wallet.isMyVout(vout.script);
                if ((UTXO_STATE & filter) == 0) {
                    continue;
                }
                console.log('Mine', vout);
                totBalance += vout.value;
            }
        }
        return totBalance;
    }
    /**
     * Outpoint that we want to fetch
     * @param {COutpoint} op
     */
    async hasUTXO(op, filter, onlyConfirmed) {
        // If the outpoint is spent return false
        if (this.isSpent(op)) {
            return false;
        }
        // If we don't have the outpoint return false
        if (!this.txmap.has(op.txid)) {
            return false;
        }
        const tx = this.txmap.get(op.txid);
        // Check if the tx is confirmed
        if (onlyConfirmed && !tx.isConfirmed()) {
            return false;
        }
        const vout = tx.vout[op.n];
        const [UTXO_STATE, _] = await wallet.isMyVout(vout.script);
        // Check if the UTXO has the state we wanted
        if ((UTXO_STATE & filter) == 0) {
            return false;
        }
        return true;
    }
    async getAllUTXOsWithValue(val, filter, onlyConfirmed) {
        let utxos = new Map();
        for (let [txid, tx] of this.txmap) {
            if (onlyConfirmed && !tx.isConfirmed()) {
                continue;
            }
            for (let vout of tx.vout) {
                if (vout.value != val) {
                    continue;
                }
                const op = new COutpoint({ txid: txid, n: vout.n });
                if (this.isSpent(op)) {
                    continue;
                }
                const [UTXO_STATE, path] = await wallet.isMyVout(vout.script);
                if ((UTXO_STATE & filter) == 0) {
                    continue;
                }
                utxos.set(
                    path,
                    new UTXO({
                        id: txid,
                        sats: vout.value,
                        script: vout.script,
                        path: path,
                        vout: vout.n,
                    })
                );
            }
        }
        return utxos;
    }
    // a bit a copy and paste from getBalanceNew, TODO: remove the copy and paste
    async getUTXOs(filter, onlyConfirmed = false) {
        let utxos = [];
        for (let [txid, tx] of this.txmap) {
            if (onlyConfirmed && !tx.isConfirmed()) {
                continue;
            }
            for (let vout of tx.vout) {
                const op = new COutpoint({ txid: txid, n: vout.n });
                if (this.isSpent(op)) {
                    continue;
                }
                const [UTXO_STATE, path] = await wallet.isMyVout(vout.script);
                if ((UTXO_STATE & filter) == 0) {
                    continue;
                }

                utxos.push(
                    new UTXO({
                        id: txid,
                        sats: vout.value,
                        script: vout.script,
                        path: path,
                        vout: vout.n,
                    })
                );
            }
        }
        console.log(utxos);
        return utxos;
    }
    parseTransaction(tx) {
        let vout = [];
        let vin = [];
        for (const out of tx.vout) {
            vout.push(
                new CTxOut({
                    n: out.n,
                    script: out.scriptPubKey.hex,
                    value: out.value * COIN,
                })
            );
        }
        for (const inp of tx.vin) {
            const op = new COutpoint({ txid: inp.txid, n: inp.vout });
            vin.push(new CTxIn({ outpoint: op, scriptSig: inp.scriptSig.hex }));
        }
        return new Transaction({
            txid: tx.txid,
            blockHeight:
                getNetwork().cachedBlockCount -
                (tx.confirmations - 1) -
                tx.confirmations,
            vin: vin,
            vout: vout,
        });
    }
    /**
     * Update the mempool status
     * @param {Transaction} tx
     */
    async updateMempool(tx) {
        this.txmap.set(tx.txid, tx);
        for (const vin of tx.vin) {
            const op = vin.outpoint;
            if (!this.isSpent(op)) {
                this.spent.set(op.txid, op);
            }
        }
        this.#balance = await this.getBalanceNew(UTXO_WALLET_STATE.SPENDABLE);
        this.#coldBalance = await this.getBalanceNew(
            UTXO_WALLET_STATE.SPENDABLE_COLD
        );
    }
}
