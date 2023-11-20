import { LightningElement } from 'lwc';
import { CONSTANTS } from 'c/constants';

export default class Popup extends LightningElement {

    isLoading = true;
    currentOrgId;
    activeTabs = [];

    connectedCallback(){
        this.init();
    }

    async init(){
        // get active page org id if its a salesforce page.
        const params = { active: true, currentWindow: true };
        const activeTabs = await chrome.tabs.query(params);
        this.activeTabs = activeTabs;
        if (activeTabs && activeTabs.length) {
            try {
                this.currentOrgId = await chrome.tabs.sendMessage(activeTabs[0].id, { action: CONSTANTS.GET_ORG_ID });
            } 
            catch (error) {
                console.log('%cError ', 'background: red', 'content script not loaded');
            }
        }


        this.isLoading = false;
    }
}
