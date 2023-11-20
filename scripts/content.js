// es import not yet supported in content scripts.
// should be in const file
const CONSTANTS = {
    GROUP_EXISTANCE_CHECK: 'GROUP_EXISTANCE_CHECK',
    MOVE_TO_GROUP: 'MOVE_TO_GROUP',
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
    const orgId = getOrgIdFromCookie();
    // if org id found, ask service worker to group
    if(orgId){
        const existanceCheckResponse = await chrome.runtime.sendMessage({
            action: CONSTANTS.GROUP_EXISTANCE_CHECK,
            orgId: orgId
        });

        if(existanceCheckResponse.isExisting){
            await chrome.runtime.sendMessage({
                action: CONSTANTS.MOVE_TO_GROUP,
                orgId: orgId
            });
        }
        else {
            const createGroup = prompt("Create Group?", existanceCheckResponse.nameSuggestion);
            if(createGroup !== null){
                await chrome.runtime.sendMessage({
                    action: CONSTANTS.MOVE_TO_GROUP,
                    orgId: orgId, 
                    name: createGroup
                });
            }
        }
    }
}

// content js starting point
init();
