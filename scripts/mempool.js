"use strict";
//STATUS: OK, REMOVED, REWARD, INCOMING, LOCKED

class UTXO{
    constructor({id, path, sats, script, vout,height,status} = {}) {
            this.id=id;
            this.path=path;
            this.sats=sats;
            this.script=script;
            this.vout=vout;
            this.status=status;
            this.height=height;
        }
};

class Mempool{

    constructor(){
        this.UTXOs=[]
    }
    static OK="OK";
    static REMOVED="REMOVED";
    static T_PENDING="T_PENDING";
    static D_PENDING="D_PENDING";
    static DELEGATE="DELEGATE";

    async autoRemove(nBlocks,utxo){
        const delay = ms => new Promise(res => setTimeout(res, ms));
        await delay(nBlocks*60*1000);
        this.removeUTXO(utxo);
        console.log("awaited", nBlocks*60);
    }

    isAlreadyStored(newUtxo){
        for(let utxo of this.UTXOs){
            if(JSON.stringify(utxo)===JSON.stringify(newUtxo)){
                return true;
            }
        }
        return false;
    }

    isBeingRemoved(newUtxo){
        return this.isAlreadyStored(newUtxo);
    }

    getSubsetUTXOs(kind){
        return this.UTXOs.filter(utxo => utxo.status===kind)
    }
    resolvesTPending(newUtxo){
        let pendingUTXOs=this.getSubsetUTXOs(Mempool.T_PENDING);
        for(let utxo of pendingUTXOs){
            if(utxo.id===newUtxo.id && utxo.vout===newUtxo.vout){
                this.removeUTXO(utxo);
                break;
            }
        }
    }

    resolvesDPending(newUtxo){
        let pendingUTXOs=this.getSubsetUTXOs(Mempool.D_PENDING);
        for(let utxo of pendingUTXOs){
            if(utxo.id===newUtxo.id && utxo.vout===newUtxo.vout){
                this.removeUTXO(utxo);
                break;
            }
        }
    }

    addUTXO(id,path,sats,script,vout,blockHeight,status){
        const newUtxo = new UTXO({id:id,path:path,sats:sats,script:script,vout:vout,height:blockHeight,status:status});
        if(this.isAlreadyStored(newUtxo)) return;
        if(this.isBeingRemoved(new UTXO({id:id,path:path,sats:sats,script:script,vout:vout,height:blockHeight,status:Mempool.REMOVED}))) return;
        this.resolvesTPending(newUtxo);
        if(status===Mempool.DELEGATE) this.resolvesDPending(newUtxo);
        
        this.UTXOs.push(newUtxo);
    }

    removeUTXO(id,path,sats,script,vout,blockHeight){
        const newUtxo = new UTXO({id:id,path:path,sats:sats,script:script,vout:vout,height:blockHeight,status:Mempool.OK});
        this.UTXOs=this.UTXOs.filter(utxo => JSON.stringify(utxo)!== JSON.stringify(newUtxo));
    }
    removeUTXO(utxoToRemove){
        this.UTXOs=this.UTXOs.filter(utxo => JSON.stringify(utxo)!== JSON.stringify(utxoToRemove));
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