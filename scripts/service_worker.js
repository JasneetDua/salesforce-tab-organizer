// es import not yet supported in content scripts.
// should be in const file
const CONSTANTS = {
    GET_ORG_ID: 'GetOrgId',
    REFRESH: 'Refresh',
    GROUP_EXISTANCE_CHECK: 'GROUP_EXISTANCE_CHECK',
    MOVE_TO_GROUP: 'MOVE_TO_GROUP',
    GET_SETTINGS: 'GET_SETTINGS',
};

const settings = {
    enableOrganizer: true,
    enableGroupNamePrompt: true,
}


const createGroup = async (currentTab, orgId, name) => {
    // check group existance for the passed org id
    const existingGroup = await chrome.storage.session.get([orgId]);
    const existingGroupId = existingGroup[orgId];

    if (existingGroupId) {
        // add tab in existing group
        await chrome.tabs.group({ tabIds: currentTab.id, groupId: existingGroupId });
    }
    else {
        // create new group and add tab into the group
        const newGroup = await chrome.tabs.group({ tabIds: currentTab.id });
        await chrome.storage.session.set({ [orgId]: newGroup });
        await chrome.tabGroups.update(newGroup, { title: name });
    }
}


const getNameSuggestion = (origin) => {
    const originSegments = origin.split('.');
    if (originSegments.length) {
        const instanceName = originSegments[0];
        const indexOfProtocolSlashes = instanceName.indexOf('//');
        if (indexOfProtocolSlashes !== -1) {
            return instanceName.substring(indexOfProtocolSlashes + 2);
        }
        else {
            return instanceName;
        }
    }
    return 'Salesforce';
}


const handleRefresh = async (sendResponse) => {
    try {

        // ungroup all grouped tabs
        const groupMap = await chrome.storage.session.get();
        const tabsPromisesList = Object.values(groupMap).map((groupId) => {
            return chrome.tabs.query({ groupId: groupId });
        });

        const listOfTabList = await Promise.all(tabsPromisesList);
        const tabList = listOfTabList.flat();
        if(tabList.length){
            await chrome.tabs.ungroup(tabList.map(t => t.id));
        }

        // ask tabs for org id
        const allTabs = await chrome.tabs.query({});
        const tabResponsesPromise = allTabs.map(tab => {
            return chrome.tabs.sendMessage( tab.id, {action: CONSTANTS.GET_ORG_ID});
        });
        const tabResponses = await Promise.allSettled(tabResponsesPromise);
        const tabsWithOrgId = tabResponses.map((response, index) => {
            if(response.status == 'fulfilled'){
                return {
                    ...response.value,
                    tab: allTabs[index]
                }
            }
            return null;
        }).filter(tabWithId => !!tabWithId && !! tabWithId.orgId);

        // regroup tabs
        for (const tabInfo of tabsWithOrgId) {
            const nameSuggestion = getNameSuggestion(tabInfo.tab.url);
            const currentTab = tabInfo.tab;
            const orgId = tabInfo.orgId;
            const name = nameSuggestion;
            await createGroup(currentTab, orgId, name);
        }
        sendResponse(true);
    }
    catch(ex){
        sendResponse(false);
    }
}

// new tab listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if(request.action === CONSTANTS.GET_SETTINGS){
        (async () => {
            const storage = await chrome.storage.sync.get('settings');
            const userSettings = {...settings, ...storage.settings};
            sendResponse({ settings: userSettings });
        })();
        return true;
    }
    else if (request.action === CONSTANTS.MOVE_TO_GROUP) {
        const nameSuggestion = getNameSuggestion(sender.origin);
        const currentTab = sender.tab;
        const orgId = request.orgId;
        const name = !!request.name ? request.name : nameSuggestion;
        createGroup(currentTab, orgId, name);
    }
    else if (request.action === CONSTANTS.GROUP_EXISTANCE_CHECK) {
        const nameSuggestion = getNameSuggestion(sender.origin);
        const orgId = request.orgId;
        (async () => {
            const existingGroup = await chrome.storage.session.get([orgId]);
            const existingGroupId = existingGroup[orgId];

            sendResponse({
                isExisting: !!existingGroupId,
                nameSuggestion: nameSuggestion
            });
        })();
        return true;
    }
    else if(request.action == CONSTANTS.REFRESH) {
        handleRefresh(sendResponse);
        return true;
    }
});

// group removal listener
chrome.tabGroups.onRemoved.addListener(async (removedGroup) => {
    const storageMap = await chrome.storage.session.get();
    const orgId = Object.keys(storageMap)[Object.values(storageMap).indexOf(removedGroup.id)];
    if (orgId) {
        await chrome.storage.session.remove(orgId);
    }
});