/**
 * Class Multimap, alias for map of sets
 */
export class Multimap {
    /**
     * @type{Map<Object,Set<Object>>}
     */
    #multimap = new Map();
    /**
     * Set a kay value pair inside the multimap
     * @param {Object} key
     * @param {Object} value
     */
    set(key, value) {
        this.#multimap.has(key)
            ? this.#multimap.get(key).add(value)
            : this.#multimap.set(key, new Set([value]));
        }
    /**
     * Get all values corresponding to a given key
     * @param {Object} key
     * @return {Set<Object>|undefined} values
     */
    get(key) {
        return this.#multimap.get(key);
    }
    /**
     * Delete a key value pair or all values corresponding to a given key
     * @param {Object} key
     * @param {Object | undefined} value
     */
    delete(key, value) {
        value === undefined
            ? this.#multimap.delete(key)
            : this.#multimap.get(key)?.delete(value);
    }
    /**
     * @return {Number} Number of values inside the map
     */
    size() {
        let i = 0;
        this.#multimap.forEach((set) => {
            i += set.size;
        });
        return i;
    }
    /**
     * @param {Object} key
     * @param {Object | undefined} value
     * @return {Boolean} Returns true only if the key value pair is in the map
     */
    has(key, value) {
       // console.log("has?:", key,value, this.#multimap.get(key)?.has(value) ?? false)
        return value === undefined
            ? this.#multimap.has(key)
            : this.#multimap.get(key)?.has(value) ?? false;
    }
}
