import { LightningElement, track } from 'lwc';
import { CONSTANTS } from 'c/constants';

export default class Popup extends LightningElement {

    isLoading = true;
    groupMap = [];
    @track settings = {
        enableOrganizer: true,
        enableGroupNamePrompt: true,
    }

    get showExistingGroupsActions() {
        return !this.settings.enableOrganizer && Object.keys(this.groupMap).length;
    }

    connectedCallback() {
        this.init();
    }

    async init() {
        const storage = await chrome.storage.sync.get('settings');
        if (storage.settings) {
            this.settings = {
                ...this.settings,
                ...storage.settings
            }
        }
        const groupMap = await chrome.storage.session.get();
        this.groupMap = groupMap;
        this.isLoading = false;
    }

    async handleFieldChange(event) {
        const { fieldName, value } = event.detail;
        this.settings[fieldName] = value;
        await chrome.storage.sync.set({ 'settings': this.settings });
        if(fieldName == 'enableOrganizer' && !value){
            const groupMap = await chrome.storage.session.get();
            this.groupMap = groupMap;
        }
    }

    async handleAction(event) {
        const { action } = event.currentTarget.dataset;

        if(action == 'ungroup' || action == 'close'){
            const tabsPromisesList = Object.values(this.groupMap).map((groupId) => {
                return chrome.tabs.query({ groupId: groupId });
            });

            const listOfTabList = await Promise.all(tabsPromisesList);
            const tabList = listOfTabList.flat();

            if(tabList.length){
                if (action == 'ungroup') {
                    await chrome.tabs.ungroup(tabList.map(t => t.id));
                }
                else if (action == 'close') {
                    await chrome.tabs.remove(tabList.map(t => t.id));
                }
            }
        }
        else if(action == 'refresh'){
            const success = await chrome.runtime.sendMessage({action: CONSTANTS.REFRESH});
        }
    }
}
