import { LightningElement, track } from 'lwc';
import { CONSTANTS } from 'c/constants';

export default class Popup extends LightningElement {

    isLoading = true;
    @track settings = {
        enableOrganizer: true,
        // enableGroupNamePrompt: true,
    }

    connectedCallback(){
        this.init();
    }

    async init(){
        const storage = await chrome.storage.sync.get('settings');
        if(storage.settings){
            this.settings = {
                ...this.settings,
                ...storage.settings
            }
        }
        this.isLoading = false;
    }

    async handleFieldChange(event){
        const {fieldName, value} = event.detail;
        this.settings[fieldName] = value;
        await chrome.storage.sync.set({'settings': this.settings});
    }
}
