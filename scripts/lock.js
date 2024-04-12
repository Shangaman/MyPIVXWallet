/**
 * Implement a lockable object
 */
export class LockableFunction {
    /**
     * @type {boolean} whether the object is locked
     */
    #isLocked = false;
    /**
     * @type {Function} - function on which we perform the lock
     */
    #func;
    /**
     * @param {Function} func - function on which we perform the lock
     */
    constructor(func) {
        this.#func = func;
    }
    /**
     * @return {boolean} true iff the object is locked
     */
    get isLocked() {
        return this.#isLocked;
    }
    /**
     * Try to lock the object, will return true only if operation is succesful
     * @return {boolean} true if opt is locked, false otherwise
     */
    #tryLock() {
        if (this.#isLocked) return false;
        this.#isLocked = true;
        return true;
    }
    /**
     * Drop the lock
     */
    #dropLock() {
        this.#isLocked = false;
    }

    /**
     * Call the function iff the object is unlocked
     * @param  {...any} args - The arguments to pass to the function
     * @returns {Promise<void>}
     */
    async tryEval(...args) {
        if (!this.#tryLock()) return;
        try {
            await this.#func(...args);
        } finally {
            this.#dropLock();
        }
    }
}
