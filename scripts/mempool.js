import { getEventEmitter } from './event_bus.js';
import { COutpoint, UTXO } from './transaction.js';

export const OutpointState = {
    OURS: 1 << 0, // This outpoint is ours

    P2PKH: 1 << 1, // This is a P2PKH outpoint
    P2CS: 1 << 2, // This is a P2CS outpoint

    SPENT: 1 << 3, // This outpoint has been spent
    LOCKED: 1 << 5, // Coins in the LOCK set
};

export class Mempool {
    /** @type{Map<string, number>} */
    #outpointStatus = new Map();

    /**
     * Maps txid -> Transaction
     * @type{Map<string, import('./transaction.js').Transaction>}
     */
    #txmap = new Map();

    /**
     * Add a transaction to the mempool
     * And mark the input as spent.
     * @param {import('./transaction.js').Transaction} tx
     */
    addTransaction(tx) {
        this.#txmap.set(tx.txid, tx);
        for (const input of tx.vin) {
            this.setSpent(input.outpoint);
        }
    }

    /**
     * @param {COutpoint} outpoint
     */
    getOutpointStatus(outpoint) {
        return this.#outpointStatus.get(outpoint.toUnique()) ?? 0;
    }

    /**
     * Sets outpoint status to `status`, overriding the old one
     * @param {COutpoint} outpoint
     * @param {number} status
     */
    setOutpointStatus(outpoint, status) {
        this.#outpointStatus.set(outpoint.toUnique(), status);
    }

    /**
     * Adds `status` to the outpoint status, keeping the old status
     * @param {COutpoint} outpoint
     * @param {number} status
     */
    addOutpointStatus(outpoint, status) {
        const oldStatus = this.#outpointStatus.get(outpoint.toUnique());
        this.#outpointStatus.set(outpoint.toUnique(), oldStatus | status);
    }

    /**
     * Removes `status` to the outpoint status, keeping the old status
     * @param {COutpoint} outpoint
     * @param {number} status
     */
    removeOutpointStatus(outpoint, status) {
        const oldStatus = this.#outpointStatus.get(outpoint.toUnique());
        this.#outpointStatus.set(outpoint.toUnique(), oldStatus & ~status);
    }

    /**
     * Mark an outpoint as spent
     * @param {COutpoint} outpoint
     */
    setSpent(outpoint) {
        this.addOutpointStatus(outpoint, OutpointState.SPENT);
    }

    /**
     * @param {COutpoint} outpoint
     * @returns {boolean} whether or not the outpoint has been marked as spent
     */
    isSpent(outpoint) {
        return !!(this.getOutpointStatus(outpoint) & OutpointState.SPENT);
    }

    /**
     * Utility function to get the UTXO from an outpoint
     * @param {COutpoint} outpoint
     * @returns {UTXO?}
     */
    outpointToUTXO(outpoint) {
        const tx = this.#txmap.get(outpoint.txid);
        if (!tx) return null;
        return new UTXO({
            outpoint,
            script: tx.vout[outpoint.n].script,
            value: tx.vout[outpoint.n].value,
        });
    }

    /**
     * Get the debit of a transaction in satoshi
     * @param {import('./transaction.js').Transaction} tx
     */
    getDebit(tx) {
        return tx.vin
            .filter(
                (input) =>
                    this.getOutpointStatus(input.outpoint) & OutpointState.OURS
            )
            .map((i) => this.outpointToUTXO(i.outpoint))
            .reduce((acc, u) => acc + (u?.value || 0), 0);
    }

    /**
     * Get the credit of a transaction in satoshi
     * @param {import('./transaction.js').Transaction} tx
     */
    getCredit(tx) {
        const txid = tx.txid;

        return tx.vout
            .filter(
                (_, i) =>
                    this.getOutpointStatus(
                        new COutpoint({
                            txid,
                            n: i,
                        })
                    ) & OutpointState.OURS
            )
            .reduce((acc, u) => acc + u?.value ?? 0, 0);
    }

    /**
     * Loop through the unspent balance of the wallet
     * @template T
     * @param {number} requirement - Requirement that outpoints must have
     * @param {T} initialValue - initial value of the result
     * @param {balanceIterator} fn
     * @returns {T}
     */
    loopSpendableBalance(requirement, initialValue, fn) {
        for (const tx of this.#txmap.values()) {
            for (const [index, vout] of tx.vout.entries()) {
                const status = this.getOutpointStatus(
                    new COutpoint({ txid: tx.txid, n: index })
                );
                if (status & (OutpointState.SPENT | OutpointState.LOCKED)) {
                    continue;
                }
                if ((status & requirement) === requirement) {
                    initialValue = fn(tx, vout, initialValue);
                }
            }
        }
        return initialValue;
    }

    /**
     * @returns {import('./transaction.js').Transaction[]} a list of all transactions
     */
    getTransactions() {
        return Array.from(this.#txmap.values());
    }
}

/**
 * @template T
 * @typedef {Function} balanceIterator
 * @param {import('./transaction.js').Transaction} tx
 * @param {CTxOut} vout
 * @param {T} currentValue - the current value iterated
 * @returns {number} amount
 */
