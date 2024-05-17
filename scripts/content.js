// es import not yet supported in content scripts.
// should be in const file
const CONSTANTS = {
    GET_ORG_ID: 'GetOrgId',
    REFRESH: 'Refresh',
    GROUP_EXISTANCE_CHECK: 'GROUP_EXISTANCE_CHECK',
    MOVE_TO_GROUP: 'MOVE_TO_GROUP',
    GET_SETTINGS: 'GET_SETTINGS',
};

// general utils
const getCookie = (cname) => {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

const getOrgIdFromCookie = () => {
    var sid = getCookie('sid');
    var orgId = sid ? sid.split('!')[0] : null;
    return orgId;
}

// general utils ends here


const init = async () => {

    const settingsResponse = await chrome.runtime.sendMessage({
        action: CONSTANTS.GET_SETTINGS
    });

    const settings = settingsResponse.settings;
    if (!settings.enableOrganizer) {
        return;
    }
    const orgId = getOrgIdFromCookie();
    // if org id found, ask service worker to group
    if (orgId) {
        // handle popup
        if(!window.menubar.visible){
            return; // do nothing if its a lookup popup
        }
        // if ask group name is enabled
        if (settings.enableGroupNamePrompt) {
            const existanceCheckResponse = await chrome.runtime.sendMessage({
                action: CONSTANTS.GROUP_EXISTANCE_CHECK,
                orgId: orgId
            });
            if (existanceCheckResponse.isExisting) {
                await chrome.runtime.sendMessage({
                    action: CONSTANTS.MOVE_TO_GROUP,
                    orgId: orgId
                });
            }
            else {
                const createGroup = prompt("Create Group?", existanceCheckResponse.nameSuggestion);
                if (createGroup !== null) {
                    await chrome.runtime.sendMessage({
                        action: CONSTANTS.MOVE_TO_GROUP,
                        orgId: orgId,
                        name: createGroup
                    });
                }
            }
        }
        else {
            // if ask group name is disabled
            await chrome.runtime.sendMessage({
                action: CONSTANTS.MOVE_TO_GROUP,
                orgId: orgId
            });

        }
    }
}

// content js starting point
init();


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action == CONSTANTS.GET_ORG_ID) {
        const orgId = getOrgIdFromCookie();
        sendResponse({ orgId: orgId });
    }
});