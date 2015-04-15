(function()
{
    var tabsCache = {};
    var highlightOnlyOnTitleChange = false;
    var pinnedTabsOnly = false;

    var overlayIco = new Image();
    overlayIco.src = 'img/overlay.png';

    var pullTabChanges = function ()
    {
        var query = {};
        if (pinnedTabsOnly)
            query = {pinned: true};

        chrome.tabs.query(query, function (tabs)
        {
            for (var i = 0; i < tabs.length; i++)
            {
                var tab = tabs[i];
                if (typeof tabsCache[tab.id] !== 'undefined')
                {
                    if (tab.status == 'loading')
                        continue;
                    if (tab.title != tabsCache[tab.id].originalTitle)
                    {
                        //console.log('title changed for ' + tab.id, 'new:' + tab.title + ', old:' + tabsCache[tab.id].originalTitle, tab);
                        tabsCache[tab.id].originalTitle = tab.title;
                        if (!tab.highlighted && !tab.active)
                            setHighlight(tab);
                    }
                }
                else
                    storeTabInfo(tab);
            }
            setTimeout(pullTabChanges, 1000);
        });
    };

    //this is not triggered when title changes (?)
    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
        //console.log('onUpdated ' + tabId, changeInfo);
        if (pinnedTabsOnly && !tab.pinned)
            return;

        if (typeof changeInfo.status !== 'undefined')
        {
            if (changeInfo.status != 'complete')
                return;
            setOriginalFavicon(tab, function() {});
            tabsCache[tab.id].highlighted = false;
        }

        if ((typeof tabsCache[tab.id] !== 'undefined') && (typeof tabsCache[tab.id].originalIconSrc !== 'undefined'))
        {
            chrome.tabs.get(tabId, function(tab) {
                //if tab has no favicon ignore?
                if (typeof tab.favIconUrl === 'undefined')
                    return false;

                if (
                    (tab.favIconUrl != tabsCache[tab.id].originalIconSrc) &&
                    (typeof tabsCache[tab.id].currentIcon !== 'undefined') &&
                    (tab.favIconUrl != tabsCache[tab.id].currentIcon.src)
                )
                {
                    var setHighlightAfter = (tab.favIconUrl != tabsCache[tab.id].originalIconSrc);
                    //console.log('set-original', 'setHighlightAfter: ' + setHighlightAfter);
                    setOriginalFavicon(tab, function() {
                        //console.log('setOriginalFavicon callback', tab);
                        if (setHighlightAfter) {
                            //console.log('highlight after ', tab);
                            if (!highlightOnlyOnTitleChange || tab.title != tabsCache[tab.id].originalTitle)
                            {
                                tabsCache[tab.id].highlighted = false;
                                setHighlight(tab);
                            }
                        }
                    });
                }
            });
        }
        else
            storeTabInfo(tab);
    });

    chrome.tabs.onHighlighted.addListener(function (highlightInfo) {
        for (var i = 0; i < highlightInfo.tabIds.length; i++)
        {
            chrome.tabs.get(highlightInfo.tabIds[i], function(tab) {
                if (typeof tab == 'undefined')
                    return;
                if (pinnedTabsOnly && !tab.pinned)
                    return;
                //console.log('onHighlighted ' + tab.id);
                if (typeof tabsCache[tab.id] !== 'undefined')
                {
                    tabsCache[tab.id].originalTitle = tab.title;
                    clearHighlight(tab);
                }
                else
                    storeTabInfo(tab);
            });
        }
    });

    function setHighlight(tab)
    {
        if (tab.highlighted || tab.active)
            return;

        if (typeof tabsCache[tab.id].originalIconSrc === 'undefined' || typeof tabsCache[tab.id].currentIcon === 'undefined')
            return;

        if (tabsCache[tab.id].highlighted)
            return;

        tabsCache[tab.id].highlighted = true;

        //console.log('set highlight ' + tab.id);

        var base64 = createIcon(tabsCache[tab.id].originalIcon);
        tabsCache[tab.id].currentIcon.src = base64;
        injectFavicon(tab.id, base64);
    }

    function clearHighlight(tab)
    {
        if (!tabsCache[tab.id].highlighted)
            return;

        tabsCache[tab.id].highlighted = false;

        //console.log('clear highlight ' + tab.id);
        injectFavicon(tab.id, tabsCache[tab.id].originalIconSrc);
    }

    function storeTabInfo(tab)
    {
        tabsCache[tab.id] = {};
        tabsCache[tab.id].tab = tab;
        tabsCache[tab.id].originalTitle = tab.title;
        tabsCache[tab.id].highlighted = false;
        setOriginalFavicon(tab, function() {});
    }

    function setOriginalFavicon(tab, callback)
    {
        tabsCache[tab.id].originalIconSrc = tab.favIconUrl;
        if (typeof tabsCache[tab.id].originalIconSrc != 'undefined')
        {
            var img = new Image();
            img.onload = function()
            {
                tabsCache[tab.id].originalIcon = img;
                tabsCache[tab.id].currentIcon = img;
                callback();
                img.onload = null;
            };
            img.src = tabsCache[tab.id].originalIconSrc;
        }
    }

    function injectFavicon(tabId, src)
    {
        var code =
'(function()\
{\
    var link = document.querySelector("#twinkledot-icon");\
    if (!link)\
    {\
        var links = document.querySelectorAll("link[rel=\'icon\'],link[rel=\'shortcut icon\']");\
        for (var i = 0; i < links.length; i++)\
            links[i].parentNode.removeChild(links[i]);\
        link      = document.createElement("LINK");\
        link.rel  = "icon";\
        link.type = "image/x-icon";\
        link.href = "' + src + '";\
        link.id   = "twinkledot-icon";\
        document.head.appendChild(link);\
    } \
    else\
        link.href = "' + src + '"; \
})()';
        chrome.tabs.executeScript(tabId, {code: code}, function () { });
    }

    function createIcon(imgIco)
    {
        var canvas = document.createElement('canvas');
        canvas.height = canvas.width = 16;

        var ctx = canvas.getContext('2d');
        ctx.drawImage(imgIco, 0, 0, 16, 16);
        ctx.drawImage(overlayIco, 0, 0, 16, 16);
        return canvas.toDataURL('image/png');
    }

    pullTabChanges();
})();