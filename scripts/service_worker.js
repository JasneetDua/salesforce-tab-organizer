// es import not yet supported in content scripts.
// should be in const file
const CONSTANTS = {
    GET_ORG_ID: 'GetOrgId',
    REFRESH: 'Refresh',
    GROUP_EXISTANCE_CHECK: 'GROUP_EXISTANCE_CHECK',
    MOVE_TO_GROUP: 'MOVE_TO_GROUP',
    GET_SETTINGS: 'GET_SETTINGS',
    UNGROUP_ALL_TABS: 'UNGROUP_ALL_TABS',
    CLOSE_ALL_GROUP: 'CLOSE_ALL_GROUP',
};

const settings = {
    enableOrganizer: true,
    enableGroupNamePrompt: true,
    groupInNewWindow: false,
}


const createGroup = async (currentTab, orgId, name) => {
    // check group existance for the passed org id
    const orgIdGroupMapStorage = await chrome.storage.session.get('orgIdGroupMap');
    const orgIdGroupMap = orgIdGroupMapStorage.orgIdGroupMap ?? {};
    const existingGroupId = orgIdGroupMap[orgId];

    if (existingGroupId) {
        // add tab in existing group
        await chrome.tabs.group({ tabIds: currentTab.id, groupId: existingGroupId });
    }
    else {
        // create new group and add tab into the group

        const storage = await chrome.storage.sync.get('settings');
        const userSettings = { ...settings, ...storage.settings };
        if (userSettings.groupInNewWindow) {
            await chrome.windows.create({ focused: true, state: 'maximized', tabId: currentTab.id });
        }
        const newGroupId = await chrome.tabs.group({ tabIds: currentTab.id });
        await chrome.storage.session.set({ 'orgIdGroupMap': { ...orgIdGroupMap, [orgId]: newGroupId } });
        await chrome.tabGroups.update(newGroupId, { title: name });
        // maintain dictionary of names
        const orgNameMapStorage = await chrome.storage.sync.get('orgNameMap');
        const orgNameMap = orgNameMapStorage.orgNameMap ?? {};
        await chrome.storage.sync.set({ 'orgNameMap': { ...orgNameMap, [orgId]: name } });
    }
}


const getNameSuggestion = async (origin, orgId) => {
    const orgNameMapStorage = await chrome.storage.sync.get('orgNameMap');
    const orgNameMap = orgNameMapStorage.orgNameMap ?? {};
    if (orgNameMap[orgId]) {
        return orgNameMap[orgId];
    }

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
        const orgIdGroupMapStorage = await chrome.storage.session.get('orgIdGroupMap');
        const orgIdGroupMap = orgIdGroupMapStorage.orgIdGroupMap ?? {};
        const tabsPromisesList = Object.values(orgIdGroupMap).map((groupId) => {
            return chrome.tabs.query({ groupId: groupId });
        });

        const listOfTabList = await Promise.all(tabsPromisesList);
        const tabList = listOfTabList.flat();
        if (tabList.length) {
            await chrome.tabs.ungroup(tabList.map(t => t.id));
        }
        await chrome.storage.session.remove('orgIdGroupMap');
        // ask tabs for org id
        const allTabs = await chrome.tabs.query({});
        const tabResponsesPromise = allTabs.map(tab => {
            return chrome.tabs.sendMessage(tab.id, { action: CONSTANTS.GET_ORG_ID });
        });
        const tabResponses = await Promise.allSettled(tabResponsesPromise);
        const tabsWithOrgId = tabResponses.map((response, index) => {
            if (response.status == 'fulfilled') {
                return {
                    ...response.value,
                    tab: allTabs[index]
                }
            }
            return null;
        }).filter(tabWithId => !!tabWithId && !!tabWithId.orgId);

        // regroup tabs
        for (const tabInfo of tabsWithOrgId) {
            const nameSuggestion = await getNameSuggestion(tabInfo.tab.url, tabInfo.orgId);
            const currentTab = tabInfo.tab;
            const orgId = tabInfo.orgId;
            const name = nameSuggestion;
            await createGroup(currentTab, orgId, name);
        }
        sendResponse(true);
    }
    catch (ex) {
        sendResponse(false);
    }
}


const handleUngroup = async (sendResponse, ungroupAndClose) => {
    const orgIdGroupMapStorage = await chrome.storage.session.get('orgIdGroupMap');
    const orgIdGroupMap = orgIdGroupMapStorage.orgIdGroupMap ?? {};

    const tabsPromisesList = Object.values(orgIdGroupMap).map((groupId) => {
        return chrome.tabs.query({ groupId: groupId });
    });

    const listOfTabList = await Promise.all(tabsPromisesList);
    const tabList = listOfTabList.flat();

    if (tabList.length) {
        const tabIdList = tabList.map(t => t.id);
        await chrome.storage.session.remove('orgIdGroupMap');
        if (ungroupAndClose) {
            await chrome.tabs.remove(tabIdList);
        }
        else {
            await chrome.tabs.ungroup(tabIdList);
        }
    }
    sendResponse(true);
}

// new tab listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === CONSTANTS.GET_SETTINGS) {
        (async () => {
            const storage = await chrome.storage.sync.get('settings');
            const userSettings = { ...settings, ...storage.settings };
            sendResponse({ settings: userSettings });
        })();
        return true;
    }
    else if (request.action === CONSTANTS.MOVE_TO_GROUP) {
        (async () => {
            const currentTab = sender.tab;
            const orgId = request.orgId;
            const nameSuggestion = await getNameSuggestion(sender.origin, orgId);
            const name = !!request.name ? request.name : nameSuggestion;
            createGroup(currentTab, orgId, name);
        })();
    }
    else if (request.action === CONSTANTS.GROUP_EXISTANCE_CHECK) {
        (async () => {
            const orgId = request.orgId;
            const nameSuggestion = await getNameSuggestion(sender.origin, orgId);
            const orgIdGroupMapStorage = await chrome.storage.session.get('orgIdGroupMap');
            const orgIdGroupMap = orgIdGroupMapStorage.orgIdGroupMap ?? {};
            const existingGroupId = orgIdGroupMap[orgId];

            sendResponse({
                isExisting: !!existingGroupId,
                nameSuggestion: nameSuggestion
            });
        })();
        return true;
    }
    else if (request.action == CONSTANTS.REFRESH) {
        handleRefresh(sendResponse);
        return true;
    }
    else if (request.action == CONSTANTS.CLOSE_ALL_GROUP || request.action == CONSTANTS.UNGROUP_ALL_TABS) {
        handleUngroup(sendResponse, request.action == CONSTANTS.CLOSE_ALL_GROUP);
        return true;
    }
});

// group removal listener
chrome.tabGroups.onRemoved.addListener(async (removedGroup) => {
    const orgIdGroupMapStorage = await chrome.storage.session.get('orgIdGroupMap');
    let orgIdGroupMap = orgIdGroupMapStorage.orgIdGroupMap ?? {};

    const orgId = Object.keys(orgIdGroupMap)[Object.values(orgIdGroupMap).indexOf(removedGroup.id)];
    if (orgId) {
        delete orgIdGroupMap[orgId];
        await chrome.storage.session.set({ 'orgIdGroupMap': orgIdGroupMap });
    }
});


// to monitor changes
chrome.storage.onChanged.addListener(function (changes, storageName) {
    if (storageName == 'session') {
        if (changes.orgIdGroupMap) {
            let groupCounts = 0;
            if (changes.orgIdGroupMap.newValue) {
                groupCounts = Object.keys(changes.orgIdGroupMap.newValue).length;
            }
            chrome.action.setBadgeText({ "text": groupCounts.toString() });
        }
    }
});

chrome.action.setBadgeBackgroundColor({ color: '#008080' });
chrome.action.setBadgeTextColor({ color: '#FFF' });


// group update listener
chrome.tabGroups.onUpdated.addListener(async (updatedGroup) => {

    const orgIdGroupMapStorage = await chrome.storage.session.get('orgIdGroupMap');
    let orgIdGroupMap = orgIdGroupMapStorage.orgIdGroupMap ?? {};
    const orgId = Object.keys(orgIdGroupMap)[Object.values(orgIdGroupMap).indexOf(updatedGroup.id)];
    if (orgId) {
        const orgNameMapStorage = await chrome.storage.sync.get('orgNameMap');
        const orgNameMap = orgNameMapStorage.orgNameMap ?? {};
        await chrome.storage.sync.set({ 'orgNameMap': { ...orgNameMap, [orgId]: updatedGroup.title } });
    }
});