import { getNetwork } from './network.js';
import {
    activityDashboard,
    getBalance,
    getStakingBalance,
    stakingDashboard,
} from './global.js';
import { getEventEmitter } from './event_bus.js';
import Multimap from 'multimap';
import { wallet } from './wallet.js';
import { COIN } from './chain_params.js';

export class CTxOut {
    /**
     * @param {Object} CTxOut
     * @param {COutpoint} CTxOut.outpoint - COutpoint of the CTxOut
     * @param {String} CTxOut.script - Redeem script, in HEX
     * @param {Number} CTxOut.value - Value in satoshi
     */
    constructor({ outpoint, script, value } = {}) {
        /** COutpoint of the CTxOut
         *  @type {COutpoint} */
        this.outpoint = outpoint;
        /** Redeem script, in hex
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
        /** Inputs of the transaction
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

export const UTXO_WALLET_STATE = {
    NOT_MINE: 0, // Don't have the key to spend this utxo
    SPENDABLE: 1, // Have the key to spend this (P2PKH) utxo
    SPENDABLE_COLD: 2, // Have the key to spend this (P2CS) utxo
    COLD_RECEIVED: 4, // Have the staking key of this (P2CS) utxo
    SPENDABLE_TOTAL: 1 | 2,
};

/** A Mempool instance, stores and handles UTXO data for the wallet */
export class Mempool {
    /**
     * @type {boolean}
     */
    #isLoaded = false;
    /**
     * @type {number} - Our Public balance in Satoshis
     */
    #balance = 0;
    /**
     * @type {number} - Our Cold Staking balance in Satoshis
     */
    #coldBalance = 0;
    /**
     * @type {Number}
     * The maximum block height that we received with the call 'utxos'
     * We don't want to receive anymore transactions which are below this block
     */
    #syncHeight = -1;
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
            //Should not really happen
            if (this.#isLoaded) {
                console.error(
                    'ERROR! Event UTXO called on already loaded mempool'
                );
                return;
            }
            const startTime = new Date();
            console.log('Started utxo fetch: ');
            for (const utxo of utxos) {
                this.#syncHeight = Math.max(this.#syncHeight, utxo.height);
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
            this.#balance = await this.getBalance(UTXO_WALLET_STATE.SPENDABLE);
            this.#coldBalance = await this.getBalance(
                UTXO_WALLET_STATE.SPENDABLE_COLD
            );
            getBalance(true);
            getStakingBalance(true);
            activityDashboard.update();
            stakingDashboard.update();
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
                // Do not accept any tx which is below the syncHeight
                if (this.#syncHeight > tx.blockHeight) {
                    continue;
                }
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
    async getBalance(filter) {
        const startTime = new Date();
        console.log('Starting calculating total balance');
        let totBalance = 0;
        for (const [_, tx] of this.txmap) {
            for (const vout of tx.vout) {
                if (this.isSpent(vout.outpoint)) {
                    continue;
                }
                const UTXO_STATE = await wallet.isMyVout(vout.script);
                if ((UTXO_STATE & filter) == 0) {
                    continue;
                }
                totBalance += vout.value;
            }
        }
        const endTime = new Date();
        console.log(
            'Finished calculating total balance',
            (endTime - startTime) / 1000
        );
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
        const UTXO_STATE = await wallet.isMyVout(vout.script);
        // Check if the UTXO has the state we wanted
        if ((UTXO_STATE & filter) == 0) {
            return false;
        }
        return true;
    }

    /**
     * Get a list of UTXOs
     * @param {Object} o
     * @param {Number} o.filter enum element of UTXO_WALLET_STATE
     * @param {Number | null} o.target PIVs in satoshi that we want to spend
     * @param {Boolean} o.onlyConfiemd Consider only confirmed transactions
     * @returns {Promise<CTxOut[]>} Array of fetched UTXOs
     */
    async getUTXOs({ filter, target, onlyConfirmed = false }) {
        const startTime = new Date();
        let totFound = 0;
        console.log('Starting fetching UTXOs from wallet data:');
        let utxos = [];
        for (const [_, tx] of this.txmap) {
            if (onlyConfirmed && !tx.isConfirmed()) {
                continue;
            }
            for (const vout of tx.vout) {
                if (this.isSpent(vout.outpoint)) {
                    continue;
                }
                const UTXO_STATE = await wallet.isMyVout(vout.script);
                if ((UTXO_STATE & filter) == 0) {
                    continue;
                }
                utxos.push(vout);
                // Return early if you found enough PIVs (11/10 is to make sure to pay fee)
                totFound += vout.value;
                if (target && totFound > (11 / 10) * target) {
                    const endTime = new Date();
                    console.log(
                        'Finished early fetching UTXOs from wallet data:',
                        (endTime - startTime) / 1000
                    );
                    return utxos;
                }
            }
        }
        const endTime = new Date();
        console.log(
            'Finished fetching UTXOs from wallet data:',
            (endTime - startTime) / 1000
        );
        return utxos;
    }
    parseTransaction(tx) {
        let vout = [];
        let vin = [];
        for (const out of tx.vout) {
            vout.push(
                new CTxOut({
                    outpoint: new COutpoint({ txid: tx.txid, n: out.n }),
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
            vin,
            vout,
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
        this.#balance = await this.getBalance(UTXO_WALLET_STATE.SPENDABLE);
        this.#coldBalance = await this.getBalance(
            UTXO_WALLET_STATE.SPENDABLE_COLD
        );
        getBalance(true);
        getStakingBalance(true);
    }
}
