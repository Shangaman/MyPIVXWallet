"use strict";
//STATUS: OK, REMOVED, REWARD, INCOMING, LOCKED

/** An Unspent Transaction Output, used as Inputs of future transactions */
class UTXO {
    /**
     * @param {string} id - Transaction ID
     * @param {string} path - If applicable, the HD Path of the owning address
     * @param {number} sats - The satoshi value in this UTXO
     * @param {string} script - The HEX encoded spending script
     * @param {number} vout - The output position of this transaction
     * @param {number} height - The block height of the UTXO
     * @param {number} status - The UTXO status enum state
     */
    constructor({id, path, sats, script, vout, height, status} = {}) {
        this.id = id;
        this.path = path;
        this.sats = sats;
        this.script = script;
        this.vout = vout;
        this.height = height;
        this.status = status;
    }
};

/** A Mempool instance, stores and handles UTXO data for the wallet */
class Mempool {
    constructor() {
        /** 
         * An array of all known UTXOs
         * @type {Array<UTXO>}
         */
        this.UTXOs = [];
    }

    /** The OK state (UTXO is spendable) */
    static OK = 0;

    /** The REMOVED state (UTXO was spent and will be removed soon) */
    static REMOVED = 1;

    /** The PENDING state (UTXO is in mempool, pending confirmation) */
    static T_PENDING = 2;

    static D_PENDING = 3;

    static DELEGATE = 4;

    /**
     * Remove a UTXO after a set amount of time
     * @param {Number} nBlocks - Estimated blocks to wait
     * @param {UTXO} cUTXO - UTXO to remove
     */
     async autoRemove(nBlocks, cUTXO) {
        await sleep(nBlocks * 60 * 1000);
        this.removeUTXO(cUTXO);
    }

    /**
     * Check if an exact UTXO match can be found in our wallet
     * @param {UTXO} cNewUTXO 
     * @returns {Boolean} `true` or `false`
     */
    isAlreadyStored(cNewUTXO) {
        for (const cUTXO of this.UTXOs) {
            if (JSON.stringify(cUTXO) === JSON.stringify(cNewUTXO)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Fetches an array of UTXOs filtered by their state
     * @param {number} nState - The UTXO state
     * @returns {Array<UTXO>} `array` - An array of UTXOs
     */
    getUTXOsByState(nState) {
        return this.UTXOs.filter(cUTXO => cUTXO.status === nState);
    }

    /**
     * Removes a pending UTXO
     * @param {UTXO} cNewUTXO - The pending UTXO to remove
     */
    resolvesPending(cNewUTXO, nType) {
        const arrPendingUTXOs = this.getUTXOsByState(nType);
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
     * @param {string} id - Transaction ID
     * @param {string} path - If applicable, the HD Path of the owning address
     * @param {number} sats - The satoshi value in this UTXO
     * @param {string} script - The HEX encoded spending script
     * @param {number} vout - The output position of this transaction
     * @param {number} height - The block height of the UTXO
     * @param {number} status - The UTXO status enum state
     */
    addUTXO(id, path, sats, script, vout, height, status) {
        const newUTXO = new UTXO({id, path, sats, script, vout, height, status});
        // Ensure the new UTXO doesn't have the same status
        if (this.isAlreadyStored(newUTXO)) return;

        // Ensure the new UTXO doesn't have a REMOVED status
        if (this.isAlreadyStored(new UTXO({id, path, sats, script, vout, height, status: Mempool.REMOVED}))) return;
        
        // Remove any pending versions of this UTXO
        this.resolvesPending(newUTXO, Mempool.T_PENDING);

        // If delegated, remove pending versions of that too
        if (status === Mempool.DELEGATE) this.resolvesPending(newUTXO, Mempool.D_PENDING);

        // Add to list
        this.UTXOs.push(newUTXO);
    }

    /**
     * Remove a UTXO completely from our wallet
     * @param {UTXO} cUTXO
     */
    removeUTXO(cUTXO) {
        this.UTXOs = this.UTXOs.filter(utxo => JSON.stringify(utxo) !== JSON.stringify(cUTXO));
    }

    autoRemoveUTXOs(utxos){
        for(let new_utxo of utxos){
            for(let utxo of this.UTXOs){
                if(JSON.stringify(utxo)===JSON.stringify(new_utxo)){
                    utxo.status=Mempool.REMOVED;
                    this.autoRemove(2,utxo);
                    break
                }
            }    
        }
    }
    changeUTXOstatus(id,path,sats,script,vout,newStatus){
        for (let i = 0; i < this.UTXOs.length; i++) {
            const utxo= this.UTXOs[i];
            if(utxo.id===id && utxo.path===path && utxo.sats===sats && utxo.script===script && utxo.vout===vout){
                this.UTXOs[i].status=newStatus;
                if(newStatus===Mempool.REMOVED){
                    this.autoRemove(2,this.UTXOs[i]);
                }
                return;
            }
        }
        console.log("mempool error: UTXO NOT FOUND");
    }
    getBalance(){
        return this.UTXOs.filter(utxo => (utxo.status===Mempool.OK ||utxo.status===Mempool.T_PENDING)).reduce((a,b)=> a+b.sats,0)
    }
    getDelegatedBalance(){
        return this.UTXOs.filter(utxo => (utxo.status===Mempool.DELEGATE ||utxo.status===Mempool.D_PENDING)).reduce((a,b)=> a+b.sats,0);
    }
};