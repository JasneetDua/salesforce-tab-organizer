import { LightningElement, track } from 'lwc';
import { CONSTANTS } from 'c/constants';

export default class Popup extends LightningElement {

    isLoading = true;
    orgIdGroupMap = {};
    @track settings = {
        enableOrganizer: true,
        enableGroupNamePrompt: true,
        groupInNewWindow: false,
    }

    get showExistingGroupsActions() {
        return !this.settings.enableOrganizer && Object.keys(this.orgIdGroupMap).length;
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
        await this.refreshOrgIdGroupMap();
        this.isLoading = false;
    }

    async handleFieldChange(event) {
        const { fieldName, value } = event.detail;
        this.settings[fieldName] = value;
        await chrome.storage.sync.set({ 'settings': this.settings });
        if(fieldName == 'enableOrganizer'){
            if(value){
                const success = await chrome.runtime.sendMessage({action: CONSTANTS.REFRESH});
            }
            else {
                await this.refreshOrgIdGroupMap();
            }
        }
    }

    async handleAction(event) {
        const { action } = event.currentTarget.dataset;

        if(action == 'ungroup' || action == 'close'){
            const tabsPromisesList = Object.values(this.orgIdGroupMap).map((groupId) => {
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

    async refreshOrgIdGroupMap(){
        const orgIdGroupMapStorage = await chrome.storage.session.get('orgIdGroupMap');
        this.orgIdGroupMap = orgIdGroupMapStorage.orgIdGroupMap ?? {};
    }
}
