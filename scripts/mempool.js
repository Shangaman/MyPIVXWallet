import { getNetwork } from './network.js';
import { getBalance, getStakingBalance } from './global.js';
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
        return this.id === cUTXO.id && this.vout === cUTXO.vout;
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
         * A map of all known transactions
         * @type {Map<String, Transaction>}
         */
        this.txmap = new Map();
        this.subscribeToNetwork();
    }

    reset() {
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

    /**
     * Subscribes to network events
     * @param {Network} network
     */
    subscribeToNetwork() {
        getEventEmitter().on('utxo', async (utxos) => {
            // For some reasons we are receiving empty [] sometimes  (it happens once the network is switched). In this case bail
            if (utxos.length == 0) {
                return;
            }
            //Should not really happen
            if (this.#isLoaded) {
                console.log(
                    'ERROR! Event UTXO called on already loaded mempool'
                );
                return;
            }
            const startTime = new Date();
            console.log('Started utxo fetch: ');
            console.log(this);
            for (const utxo of utxos) {
                if (this.txmap.has(utxo.txid)) {
                    continue;
                }
                // If the UTXO is new, we'll process it and add it internally
                const tx = await getNetwork().getTxFullInfo(utxo.txid);
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
            this.#isLoaded = true;
            this.#balance = await this.getBalanceNew(
                UTXO_WALLET_STATE.SPENDABLE
            );
            this.#coldBalance = await this.getBalanceNew(
                UTXO_WALLET_STATE.SPENDABLE_COLD
            );
            getBalance(true);
            getStakingBalance(true);
            const endTime = new Date();
            console.log('Ended utxo fetch in:', (endTime - startTime) / 1000);
        });
        getEventEmitter().on('recent_txs', async (txs) => {
            // Don't process recent_txs if mempool is not loaded yet
            if (!this.#isLoaded) {
                return;
            }
            const startTime = new Date();
            console.log('Started recent tx fetch: ');
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
            const endTime = new Date();
            console.log(
                'Ended recent tx fetch in:',
                (endTime - startTime) / 1000
            );
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
    // a bit a copy and paste from getBalanceNew, TODO: remove the copy and paste
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
        getBalance(true);
        getStakingBalance(true);
    }
}
