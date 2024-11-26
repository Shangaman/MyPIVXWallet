import { COutpoint } from './transaction.js';
import { TransactionBuilder } from './transaction_builder.js';
import Masternode from './masternode.js';
import { ALERTS, tr, start as i18nStart, translation } from './i18n.js';
import { wallet, hasEncryptedWallet, Wallet } from './wallet.js';
import { getNetwork } from './network/network_manager.js';
import {
    start as settingsStart,
    strCurrency,
    fAdvancedMode,
} from './settings.js';
import { createAndSendTransaction } from './legacy.js';
import { createAlert } from './alerts/alert.js';
import { confirmPopup, sanitizeHTML } from './misc.js';
import { cChainParams, COIN } from './chain_params.js';
import { sleep } from './utils.js';
import { registerWorker } from './native.js';
import { Address6 } from 'ip-address';
import { getEventEmitter } from './event_bus.js';
import { Database } from './database.js';
import { checkForUpgrades } from './changelog.js';
import { FlipDown } from './flipdown.js';
import { createApp } from 'vue';
import Dashboard from './dashboard/Dashboard.vue';
import Alerts from './alerts/Alerts.vue';
import { loadDebug, debugLog, DebugTopics, debugError } from './debug.js';
import Stake from './stake/Stake.vue';
import { createPinia } from 'pinia';
import { cOracle } from './prices.js';

import pIconCheck from '../assets/icons/icon-check.svg';
import SideNavbar from './SideNavbar.vue';
import { AsyncInterval } from './async_interval.js';
import { useNetwork } from './composables/use_network.js';

/** A flag showing if base MPW is fully loaded or not */
export let fIsLoaded = false;

/** A getter for the flag showing if base MPW is fully loaded or not */
export function isLoaded() {
    return fIsLoaded;
}

// Block count
export let blockCount = 0;

export let doms = {};

const pinia = createPinia();

export const dashboard = createApp(Dashboard).use(pinia).mount('#DashboardTab');
createApp(Stake).use(pinia).mount('#StakingTab');
createApp(SideNavbar).use(pinia).mount('#SideNavbar');
createApp(Alerts).use(pinia).mount('#Alerts');

export async function start() {
    doms = {
        domLightBackground: document.getElementById('page-container-light'),
        domNavbar: document.getElementById('navbar'),
        domNavbarToggler: document.getElementById('navbarToggler'),
        domDashboard: document.getElementById('dashboard'),
        domStakeTab: document.getElementById('stakeTab'),
        domModalQR: document.getElementById('ModalQR'),
        domModalQrLabel: document.getElementById('ModalQRLabel'),
        domModalQrReceiveTypeBtn: document.getElementById(
            'ModalQRReceiveTypeBtn'
        ),
        domModalQRReader: document.getElementById('qrReaderModal'),
        domQrReaderStream: document.getElementById('qrReaderStream'),
        domCloseQrReaderBtn: document.getElementById('closeQrReader'),
        domModalWalletBreakdown: document.getElementById(
            'walletBreakdownModal'
        ),
        domWalletBreakdownCanvas: document.getElementById(
            'walletBreakdownCanvas'
        ),
        domWalletBreakdownLegend: document.getElementById(
            'walletBreakdownLegend'
        ),
        domGenHardwareWallet: document.getElementById('generateHardwareWallet'),
        //GOVERNANCE ELEMENTS
        domGovTab: document.getElementById('governanceTab'),
        domGovProposalsTable: document.getElementById('proposalsTable'),
        domGovProposalsTableBody: document.getElementById('proposalsTableBody'),
        domTotalGovernanceBudget: document.getElementById(
            'totalGovernanceBudget'
        ),
        domTotalGovernanceBudgetValue: document.getElementById(
            'totalGovernanceBudgetValue'
        ),
        domAllocatedGovernanceBudget: document.getElementById(
            'allocatedGovernanceBudget'
        ),
        domAllocatedGovernanceBudgetValue: document.getElementById(
            'allocatedGovernanceBudgetValue'
        ),
        domAllocatedGovernanceBudget2: document.getElementById(
            'allocatedGovernanceBudget2'
        ),
        domAllocatedGovernanceBudgetValue2: document.getElementById(
            'allocatedGovernanceBudgetValue2'
        ),
        domGovProposalsContestedTable: document.getElementById(
            'proposalsContestedTable'
        ),
        domGovProposalsContestedTableBody: document.getElementById(
            'proposalsContestedTableBody'
        ),
        //MASTERNODE ELEMENTS
        domCreateMasternode: document.getElementById('createMasternode'),
        domControlMasternode: document.getElementById('controlMasternode'),
        domAccessMasternode: document.getElementById('accessMasternode'),
        domMnAccessMasternodeText: document.getElementById(
            'accessMasternodeText'
        ),
        domMnCreateType: document.getElementById('mnCreateType'),
        domMnTextErrors: document.getElementById('mnTextErrors'),
        domMnIP: document.getElementById('mnIP'),
        domMnTxId: document.getElementById('mnTxId'),
        domMnPrivateKey: document.getElementById('mnPrivateKey'),
        domMnDashboard: document.getElementById('mnDashboard'),
        domMnProtocol: document.getElementById('mnProtocol'),
        domMnStatus: document.getElementById('mnStatus'),
        domMnNetType: document.getElementById('mnNetType'),
        domMnNetIP: document.getElementById('mnNetIP'),
        domMnLastSeen: document.getElementById('mnLastSeen'),

        domEncryptWalletLabel: document.getElementById('encryptWalletLabel'),
        domEncryptPasswordCurrent: document.getElementById(
            'changePassword-current'
        ),
        domEncryptPasswordFirst: document.getElementById('newPassword'),
        domEncryptPasswordSecond: document.getElementById('newPasswordRetype'),
        domRedeemTitle: document.getElementById('redeemCodeModalTitle'),
        domRedeemCodeUse: document.getElementById('redeemCodeUse'),
        domRedeemCodeCreate: document.getElementById('redeemCodeCreate'),
        domRedeemCodeGiftIconBox: document.getElementById(
            'redeemCodeGiftIconBox'
        ),
        domRedeemCodeGiftIcon: document.getElementById('redeemCodeGiftIcon'),
        domRedeemCodeETA: document.getElementById('redeemCodeETA'),
        domRedeemCodeProgress: document.getElementById('redeemCodeProgress'),
        domRedeemCodeInputBox: document.getElementById('redeemCodeInputBox'),
        domRedeemCodeInput: document.getElementById('redeemCodeInput'),
        domRedeemCodeConfirmBtn: document.getElementById(
            'redeemCodeModalConfirmButton'
        ),
        domRedeemCodeModeRedeemBtn: document.getElementById(
            'redeemCodeModeRedeem'
        ),
        domRedeemCodeModeCreateBtn: document.getElementById(
            'redeemCodeModeCreate'
        ),
        domRedeemCodeCreateInput: document.getElementById(
            'redeemCodeCreateInput'
        ),
        domRedeemCodeCreateAmountInput: document.getElementById(
            'redeemCodeCreateAmountInput'
        ),
        domRedeemCodeCreatePendingList: document.getElementById(
            'redeemCodeCreatePendingList'
        ),
        domRedeemCodeDiv: document.getElementById('redeemCodeDiv'),
        domPromoTable: document.getElementById('promo-table'),
        domContactsTable: document.getElementById('contactsList'),
        domConfirmModalDialog: document.getElementById('confirmModalDialog'),
        domConfirmModalMain: document.getElementById('confirmModalMain'),
        domConfirmModalHeader: document.getElementById('confirmModalHeader'),
        domConfirmModalTitle: document.getElementById('confirmModalTitle'),
        domConfirmModalContent: document.getElementById('confirmModalContent'),
        domConfirmModalButtons: document.getElementById('confirmModalButtons'),
        domConfirmModalConfirmButton: document.getElementById(
            'confirmModalConfirmButton'
        ),
        domConfirmModalCancelButton: document.getElementById(
            'confirmModalCancelButton'
        ),

        masternodeLegacyAccessText:
            'Access the masternode linked to this address<br> Note: the masternode MUST have been already created (however it can be online or offline)<br>  If you want to create a new masternode access with a HD wallet',
        masternodeHDAccessText:
            "Access your masternodes if you have any! If you don't you can create one",
        // Aggregate menu screens and links for faster switching
        arrDomScreens: document.getElementsByClassName('tabcontent'),
        arrDomScreenLinks: document.getElementsByClassName('tablinks'),
        // Alert DOM element
        domAlertPos: document.getElementsByClassName('alertPositioning')[0],
        domChangePasswordContainer: document.getElementById(
            'changePassword-container'
        ),
        domLogOutContainer: document.getElementById('logOut-container'),
        domDebug: document.getElementById('Debug'),
        domCurrencySelect: document.getElementById('currency'),
        domExplorerSelect: document.getElementById('explorer'),
        domNodeSelect: document.getElementById('node'),
        domAutoSwitchToggle: document.getElementById('autoSwitchToggler'),
        domTranslationSelect: document.getElementById('translation'),
        domDisplayDecimalsSlider: document.getElementById('displayDecimals'),
        domDisplayDecimalsSliderDisplay:
            document.getElementById('sliderDisplay'),
        domBlackBack: document.getElementById('blackBack'),
        domWalletSettings: document.getElementById('settingsWallet'),
        domDisplaySettings: document.getElementById('settingsDisplay'),
        domWalletSettingsBtn: document.getElementById('settingsWalletBtn'),
        domDisplaySettingsBtn: document.getElementById('settingsDisplayBtn'),
        domVersion: document.getElementById('version'),
        domFlipdown: document.getElementById('flipdown'),
        domTestnetToggler: document.getElementById('testnetToggler'),
        domAdvancedModeToggler: document.getElementById('advancedModeToggler'),
        domAutoLockModeToggler: document.getElementById('autoLockModeToggler'),
        domRedeemCameraBtn: document.getElementById('redeemCameraBtn'),
    };

    // Set Copyright year on footer
    document.getElementById('copyrightYear').innerHTML =
        new Date().getFullYear();

    await i18nStart();
    await loadImages();

    // Enable all Bootstrap Tooltips
    $(function () {
        $('#displayDecimals').tooltip({
            template:
                '<div class="tooltip sliderStyle" role="tooltip"><div class="arrow"></div><div class="tooltip-inner"></div></div>',
        });
        $('[data-toggle="tooltip"]').tooltip();
    });

    // Set decimal slider event
    const sliderElement = document.getElementById('displayDecimals');
    function handleDecimalSlider() {
        setTimeout(() => {
            try {
                if (window.innerWidth > 991) {
                    const sliderHalf = Math.round(
                        document
                            .getElementById('displayDecimals')
                            .getBoundingClientRect().width / 2
                    );
                    const sliderBegin = -sliderHalf + 28;
                    const stepVal = (sliderHalf * 2) / 8 - 6.45;
                    const sliderValue = parseInt(sliderElement.value) + 1;

                    document.querySelector('.sliderStyle').style.left = `${
                        sliderBegin - stepVal + stepVal * sliderValue
                    }px`;
                    document.querySelector('.tooltip-inner').innerHTML =
                        sliderValue - 1;
                }
            } catch (e) {}
        }, 10);
    }
    sliderElement.addEventListener('input', handleDecimalSlider);
    sliderElement.addEventListener('mouseover', handleDecimalSlider);

    // Load debug
    await loadDebug();

    // Register native app service
    registerWorker();
    await settingsStart();
    subscribeToNetworkEvents();
    // Make sure we know the correct number of blocks
    await refreshChainData();
    // Load the price manager
    cOracle.load();
    new AsyncInterval(async () => {
        // Refresh blockchain data
        await refreshChainData();

        // Fetch the PIVX prices
        await refreshPriceDisplay();
    }, 15000);

    // Check for recent upgrades, display the changelog
    checkForUpgrades();

    // Update the Encryption UI (If the user has a wallet, then it changes to "Change Password" rather than "Encrypt Wallet")
    getEventEmitter().on('wallet-import', async () => {
        updateLogOutButton();
    });
    fIsLoaded = true;

    // If we haven't already (due to having no wallet, etc), display the Dashboard
    doms.domDashboard.click();
}

async function refreshPriceDisplay() {
    await cOracle.getPrice(strCurrency);
    getEventEmitter().emit('price-update');
}

function subscribeToNetworkEvents() {
    getEventEmitter().on('new-block', (block) => {
        debugLog(DebugTopics.GLOBAL, `New block detected! ${block}`);

        // If it's open: update the Governance Dashboard
        if (doms.domGovTab.classList.contains('active')) {
            updateGovernanceTab();
        }
    });

    getEventEmitter().on('transaction-sent', (success, result) => {
        if (success) {
            // Prepare an Alert action function to open the TX in the explorer
            const network = useNetwork();
            const openTxExplorer = () =>
                window.open(network.explorerUrl + '/tx/' + result, '_blank');

            // Notify the user of their transaction
            createAlert(
                'success',
                `<b>${ALERTS.TX_SENT}</b><br>${sanitizeHTML(
                    result.substring(0, 24)
                )}...`,
                15000,
                'Open In Explorer',
                openTxExplorer
            );
        } else {
            debugError(DebugTopics.NET, 'Error sending transaction:');
            debugError(DebugTopics.NET, result);
            createAlert('warning', ALERTS.TX_FAILED, 2500);
        }
    });
}

// WALLET STATE DATA

let isTestnetLastState = cChainParams.current.isTestnet;

/**
 * @type {FlipDown | null}
 */
let governanceFlipdown = null;

/**
 * Open a UI 'tab' menu, and close all other tabs, intended for frontend use
 * @param {Event} evt - The click event target
 * @param {string} tabName - The name of the tab to load
 */
export function openTab(evt, tabName) {
    // Only allow switching tabs if MPw is loaded
    if (!isLoaded()) return;

    // Hide all screens and deactivate link highlights
    for (const domScreen of doms.arrDomScreens)
        domScreen.style.display = 'none';
    for (const domLink of doms.arrDomScreenLinks)
        domLink.classList.remove('active');

    // Show and activate the given screen
    document.getElementById(tabName).style.display = 'block';
    evt.currentTarget.classList.add('active');

    // Close the navbar if it's not already closed
    if (!doms.domNavbarToggler.className.includes('collapsed'))
        doms.domNavbarToggler.click();

    if (tabName === 'Governance') {
        updateGovernanceTab();
    } else if (tabName === 'Masternode') {
        updateMasternodeTab();
    }
}

/**
 * Return locale settings best for displaying the user-selected currency
 * @param {Number} nAmount - The amount in Currency
 */
export function optimiseCurrencyLocale(nAmount) {
    // Allow manipulating the value, if necessary
    let nValue = nAmount;

    // Find the best fitting native-locale
    const cLocale = Intl.supportedValuesOf('currency').includes(
        strCurrency.toUpperCase()
    )
        ? {
              style: 'currency',
              currency: strCurrency,
              currencyDisplay: 'narrowSymbol',
          }
        : { maximumFractionDigits: 8, minimumFractionDigits: 8 };

    // Catch display edge-cases; like Satoshis having decimals.
    switch (strCurrency) {
        case 'sats':
            nValue = Math.round(nValue);
            cLocale.maximumFractionDigits = 0;
            cLocale.minimumFractionDigits = 0;
    }

    // Return display-optimised Value and Locale pair.
    return { nValue, cLocale };
}

/**
 * //TODO: remove in Governance VUE PR
 * Open the Explorer in a new tab for the current wallet, or a specific address
 * @param {string?} strAddress - Optional address to open, if void, the master key is used
 */
export async function openExplorer(strAddress = '') {
    const network = useNetwork();
    const toExport = wallet.getKeyToExport();
    if (wallet.isLoaded() && wallet.isHD() && !strAddress) {
        window.open(network.explorerUrl + '/xpub/' + toExport, '_blank');
    } else {
        window.open(network.explorerUrl + '/address/' + toExport, '_blank');
    }
}

async function loadImages() {
    const images = [
        ['mpw-main-logo', import('../assets/logo.png')],
        ['plus-icon', import('../assets/icons/icon-plus.svg')],
        ['plus-icon2', import('../assets/icons/icon-plus.svg')],
        ['plus-icon3', import('../assets/icons/icon-plus.svg')],
        ['del-wallet-icon', import('../assets/icons/icon-bin.svg')],
        ['change-pwd-icon', import('../assets/icons/icon-key.svg')],
    ];

    const promises = images.map(([id, path]) =>
        (async () => {
            try {
                if ((await path).default.includes('<svg')) {
                    document.getElementById(id).innerHTML = (
                        await path
                    ).default;
                } else {
                    document.getElementById(id).src = (await path).default;
                }
            } catch (e) {}
        })()
    );
    await Promise.all(promises);
}

let audio = null;
export async function playMusic() {
    // On first play: load the audio into memory from the host
    if (audio === null) {
        // Dynamically load the file
        audio = new Audio((await import('../assets/music.mp3')).default);
    }

    // Play or Pause
    if (audio.paused || audio.ended) {
        audio.play();
        for (const domImg of document.getElementsByTagName('img'))
            domImg.classList.add('discoFilter');
    } else {
        audio.pause();
        for (const domImg of document.getElementsByTagName('img'))
            domImg.classList.remove('discoFilter');
    }
}

/**
 * Copy a text element or string to the clipboard
 * @param {HTMLTextAreaElement} source - The source Element or String to copy
 * @param {HTMLElement} caller - The visual representation of the caller, for UI responses
 * @returns
 */
export function toClipboard(source, caller) {
    if (caller?.innerHTML === pIconCheck) return;
    if (source?.innerHTML === 'Copied!') return;

    // Fetch the text/value source
    const domElementTest = document.getElementById(source);
    const domCustomCopy =
        domElementTest?.dataset?.copy || source?.dataset?.copy;
    const domCopy = domCustomCopy || domElementTest || source;

    // Create and reuse an off-screen textbox as the clipboard source
    let domClipboard = document.getElementById('clipboard');
    if (!domClipboard) {
        domClipboard = document.createElement('textarea');
        domClipboard.id = 'clipboard';
        domClipboard.style.position = 'absolute';
        domClipboard.style.left = '-9999px';
        document.body.appendChild(domClipboard);
    }
    domClipboard.value = domCopy.value || domCopy.innerHTML || domCopy;
    domClipboard.select();
    domClipboard.setSelectionRange(0, 99999);

    // Browser-dependent clipboard execution
    if (!navigator.clipboard) {
        document.execCommand('copy');
    } else {
        navigator.clipboard.writeText(
            domCopy.value || domCopy.innerHTML || domCopy
        );
    }

    // Display a temporary checkmark response
    const cResponseCaller = caller || source;
    const strPrev = cResponseCaller.innerHTML;
    cResponseCaller.innerHTML = caller ? pIconCheck : 'Copied!';
    cResponseCaller.style.cursor = 'default';
    setTimeout(() => {
        cResponseCaller.innerHTML = strPrev;
        cResponseCaller.style.cursor = 'pointer';
    }, 1000);
}

export async function govVote(hash, voteCode) {
    if (
        (await confirmPopup({
            title: ALERTS.CONFIRM_POPUP_VOTE,
            html: ALERTS.CONFIRM_POPUP_VOTE_HTML,
        })) === true
    ) {
        const database = await Database.getInstance();
        const cMasternode = await database.getMasternode();
        if (cMasternode) {
            if ((await cMasternode.getStatus()) !== 'ENABLED') {
                createAlert('warning', ALERTS.MN_NOT_ENABLED, 6000);
                return;
            }
            const result = await cMasternode.vote(hash.toString(), voteCode); //1 yes 2 no
            if (result.includes('Voted successfully')) {
                //good vote
                cMasternode.storeVote(hash.toString(), voteCode);
                await updateGovernanceTab();
                createAlert('success', ALERTS.VOTE_SUBMITTED, 6000);
            } else if (result.includes('Error voting :')) {
                //If you already voted return an alert
                createAlert('warning', ALERTS.VOTED_ALREADY, 6000);
            } else if (result.includes('Failure to verify signature.')) {
                //wrong masternode private key
                createAlert('warning', ALERTS.VOTE_SIG_BAD, 6000);
            } else {
                //this could be everything
                debugError(DebugTopics.GOVERNANCE, result);
                createAlert('warning', ALERTS.INTERNAL_ERROR, 6000);
            }
        } else {
            createAlert('warning', ALERTS.MN_ACCESS_BEFORE_VOTE, 6000);
        }
    }
}

/**
 * Start a Masternode via a signed network broadcast
 * @param {boolean} fRestart - Whether this is a Restart or a first Start
 */
export async function startMasternode(fRestart = false) {
    const database = await Database.getInstance();
    const cMasternode = await database.getMasternode(wallet.getMasterKey());
    if (cMasternode) {
        if (
            wallet.isViewOnly() &&
            !(await restoreWallet(translation.walletUnlockMNStart))
        )
            return;
        if (await cMasternode.start()) {
            const strMsg = fRestart ? ALERTS.MN_RESTARTED : ALERTS.MN_STARTED;
            createAlert('success', strMsg, 4000);
        } else {
            const strMsg = fRestart
                ? ALERTS.MN_RESTART_FAILED
                : ALERTS.MN_START_FAILED;
            createAlert('warning', strMsg, 4000);
        }
    }
}

export async function destroyMasternode() {
    const database = await Database.getInstance();
    const cMasternode = await database.getMasternode(wallet.getMasterKey());
    if (cMasternode) {
        // Unlock the coin and update the balance
        wallet.unlockCoin(
            new COutpoint({
                txid: cMasternode.collateralTxId,
                n: cMasternode.outidx,
            })
        );

        database.removeMasternode(wallet.getMasterKey());
        createAlert('success', ALERTS.MN_DESTROYED, 5000);
        updateMasternodeTab();
    }
}

/**
 * Takes an ip address and adds the port.
 * If it's a tor address, ip.onion:port will be used (e.g. expyuzz4wqqyqhjn.onion:12345)
 * If it's an IPv4 address, ip:port will be used, (e.g. 127.0.0.1:12345)
 * If it's an IPv6 address, [ip]:port will be used, (e.g. [::1]:12345)
 * @param {String} ip - Ip address with or without port
 * @returns {String}
 */
function parseIpAddress(ip) {
    // IPv4 or tor without port
    if (ip.match(/\d+\.\d+\.\d+\.\d+/) || ip.match(/\w+\.onion/)) {
        return `${ip}:${cChainParams.current.MASTERNODE_PORT}`;
    }

    // IPv4 or tor with port
    if (ip.match(/\d+\.\d+\.\d+\.\d+:\d+/) || ip.match(/\w+\.onion:\d+/)) {
        return ip;
    }

    // IPv6 without port
    if (Address6.isValid(ip)) {
        return `[${ip}]:${cChainParams.current.MASTERNODE_PORT}`;
    }

    const groups = /\[(.*)\]:\d+/.exec(ip);
    if (groups !== null && groups.length > 1) {
        // IPv6 with port
        if (Address6.isValid(groups[1])) {
            return ip;
        }
    }

    // If we haven't returned yet, the address was invalid.
    return null;
}

export async function importMasternode() {
    const mnPrivKey = doms.domMnPrivateKey.value;
    const address = parseIpAddress(doms.domMnIP.value);
    if (!address) {
        createAlert('warning', ALERTS.MN_BAD_IP, 5000);
        return;
    }
    if (!mnPrivKey) {
        createAlert('warning', ALERTS.MN_BAD_PRIVKEY, 5000);
        return;
    }

    let collateralTxId;
    let outidx;
    let collateralPrivKeyPath;
    doms.domMnIP.value = '';
    doms.domMnPrivateKey.value = '';

    if (!wallet.isHD()) {
        // Find the first UTXO matching the expected collateral size
        const cCollaUTXO = wallet.getMasternodeUTXOs()[0];
        const balance = wallet.balance;
        // If there's no valid UTXO, exit with a contextual message
        if (!cCollaUTXO) {
            if (balance < cChainParams.current.collateralInSats) {
                // Not enough balance to create an MN UTXO
                const amount =
                    (cChainParams.current.collateralInSats - balance) / COIN;
                const ticker = cChainParams.current.TICKER;
                createAlert(
                    'warning',
                    tr(ALERTS.MN_NOT_ENOUGH_COLLAT, [
                        { amount: amount },
                        { ticker: ticker },
                    ]),
                    10000
                );
            } else {
                // Balance is capable of a masternode, just needs to be created
                // TODO: this UX flow is weird, is it even possible? perhaps we can re-design this entire function accordingly
                const amount = cChainParams.current.collateralInSats / COIN;
                const ticker = cChainParams.current.TICKER;
                createAlert(
                    'warning',
                    tr(ALERTS.MN_ENOUGH_BUT_NO_COLLAT, [
                        { amount },
                        { ticker },
                    ]),
                    10000
                );
            }
            return;
        }

        collateralTxId = cCollaUTXO.outpoint.txid;
        outidx = cCollaUTXO.outpoint.n;
        collateralPrivKeyPath = 'legacy';
    } else {
        const path = doms.domMnTxId.value;
        let masterUtxo;
        const utxos = wallet.getMasternodeUTXOs();
        for (const u of utxos) {
            if (
                u.value === cChainParams.current.collateralInSats &&
                wallet.getPath(u.script) === path
            ) {
                masterUtxo = u;
            }
        }

        // sanity check:
        if (masterUtxo.value !== cChainParams.current.collateralInSats) {
            return createAlert('warning', ALERTS.MN_COLLAT_NOT_SUITABLE, 10000);
        }
        collateralTxId = masterUtxo.outpoint.txid;
        outidx = masterUtxo.outpoint.n;
        collateralPrivKeyPath = path;
    }
    doms.domMnTxId.value = '';

    const cMasternode = new Masternode({
        walletPrivateKeyPath: collateralPrivKeyPath,
        mnPrivateKey: mnPrivKey,
        collateralTxId: collateralTxId,
        outidx: outidx,
        addr: address,
    });

    await refreshMasternodeData(cMasternode, true);
    await updateMasternodeTab();
}

export async function accessOrImportWallet() {
    // Hide and Reset the Vanity address input

    // Show Import button, hide access button
    doms.domImportWallet.style.display = 'block';
    setTimeout(() => {
        doms.domPrivKey.style.opacity = '1';
    }, 100);
    doms.domAccessWalletBtn.style.display = 'none';

    // If we have a local wallet, display the decryption prompt
    // This is no longer being used, as the user will be put in view-only
    // mode when logging in, however if the user locked the wallet before
    // #52 there would be no way to recover the public key without getting
    // The password from the user
    if (await hasEncryptedWallet()) {
        doms.domPrivKey.placeholder = translation.encryptPasswordFirst;
        doms.domImportWalletText.innerText = translation.unlockWallet;
        doms.domPrivKey.focus();
    }
}

/** Update the log out button to match the current wallet state */
export function updateLogOutButton() {
    doms.domLogOutContainer.style.display = wallet.isLoaded()
        ? 'block'
        : 'none';
}

/**
 * Sweep an address to our own wallet, spending all it's UTXOs without change
 * @param {Array<object>} arrUTXOs - The UTXOs belonging to the address to sweep
 * @param {import('./masterkey.js').LegacyMasterKey} sweepingMasterKey - The address to sweep from
 * @param {number} nFixedFee - An optional fixed satoshi fee
 * @returns {Promise<string|false>} - TXID on success, false or error on failure
 */
export async function sweepAddress(arrUTXOs, sweepingMasterKey, nFixedFee) {
    const txBuilder = TransactionBuilder.create().addUTXOs(arrUTXOs);

    const outputValue = txBuilder.valueIn - (nFixedFee || txBuilder.getFee());
    const address = wallet.getNewChangeAddress();
    const tx = txBuilder
        .addOutput({
            address,
            value: outputValue,
        })
        .build();

    // Sign using the given Master Key, then broadcast the sweep, returning the TXID (or a failure)
    const sweepingWallet = new Wallet({ nAccount: 0 });
    sweepingWallet.setMasterKey({ mk: sweepingMasterKey });

    await sweepingWallet.sign(tx);
    return await getNetwork().sendTransaction(tx.serialize());
}

export function isMasternodeUTXO(cUTXO, cMasternode) {
    if (cMasternode?.collateralTxId) {
        const { collateralTxId, outidx } = cMasternode;
        return collateralTxId === cUTXO.id && cUTXO.vout === outidx;
    } else {
        return false;
    }
}

/**
 * Prompt the user in the GUI to unlock their wallet
 * @param {string} strReason - An optional reason for the unlock
 * @returns {Promise<boolean>} - If the unlock was successful or rejected
 */
export async function restoreWallet(strReason = '') {
    // TODO: This needs to be vueified quite a bit
    // This will be done after #225 since it's already
    // way bigger than I would have liked
    return await dashboard.restoreWallet(strReason);
}

/** A lock to prevent rendering the Governance Dashboard multiple times */
let fRenderingGovernance = false;

/**
 * Fetch Governance data and re-render the Governance UI
 */
export async function updateGovernanceTab() {
    if (fRenderingGovernance) return;
    fRenderingGovernance = true;

    // Setup the Superblock countdown (if not already done), no need to block thread with await, either.
    if (isTestnetLastState !== cChainParams.current.isTestnet) {
        // Reset flipdown
        governanceFlipdown = null;
        doms.domFlipdown.innerHTML = '';
    }

    // Update governance counter when testnet/mainnet has been switched
    if (!governanceFlipdown && blockCount > 0) {
        getNetwork()
            .getNextSuperblock()
            .then((nSuperblock) => {
                // The estimated time to the superblock (using the block target and remaining blocks)
                const nTimestamp =
                    Date.now() / 1000 + (nSuperblock - blockCount) * 60;
                governanceFlipdown = new FlipDown(nTimestamp).start();
            });
        isTestnetLastState = cChainParams.current.isTestnet;
    }

    // Fetch all proposals from the network
    const arrProposals = await getNetwork().getProposals();

    /* Sort proposals into two categories
        - Standard (Proposal is either new with <100 votes, or has a healthy vote count)
        - Contested (When a proposal may be considered spam, malicious, or simply highly contestable)
    */
    const arrStandard = arrProposals.filter(
        (a) => a.Yeas + a.Nays < 100 || a.Ratio > 0.25
    );
    const arrContested = arrProposals.filter(
        (a) => a.Yeas + a.Nays >= 100 && a.Ratio <= 0.25
    );

    // Render Proposals
    await Promise.all([
        renderProposals(arrStandard, false),
        renderProposals(arrContested, true),
    ]);

    // Remove lock
    fRenderingGovernance = false;
}

/**
 * @typedef {Object} ProposalCache
 * @property {number} nSubmissionHeight - The submission height of the proposal.
 * @property {string} txid - The transaction ID of the proposal (string).
 * @property {boolean} fFetching - Indicates whether the proposal is currently being fetched or not.
 */

/**
 * An array of Proposal Finalisation caches
 * @type {Array<ProposalCache>}
 */
const arrProposalFinalisationCache = [];

/**
 * Asynchronously wait for a Proposal Tx to confirm, then cache the height.
 *
 * Do NOT await unless you want to lock the thread for a long time.
 * @param {ProposalCache} cProposalCache - The proposal cache to wait for
 * @returns {Promise<boolean>} Returns `true` once the block height is cached
 */
async function waitForSubmissionBlockHeight(cProposalCache) {
    let nHeight = null;

    // Wait in a permanent throttled loop until we successfully fetch the block
    const cNet = getNetwork();
    while (true) {
        // If a proposal is already fetching, then consequtive calls will be rejected
        cProposalCache.fFetching = true;

        // Attempt to fetch the submission Tx (may not exist yet!)
        let cTx = null;
        try {
            cTx = await cNet.getTxInfo(cProposalCache.txid);
        } catch (_) {}

        if (!cTx || !cTx.blockHeight) {
            // Didn't get the TX, throttle the thread by sleeping for a bit, then try again.
            await sleep(30000);
        } else {
            nHeight = cTx.blockHeight;
            break;
        }
    }

    // Update the proposal finalisation cache
    cProposalCache.nSubmissionHeight = nHeight;

    return true;
}

/**
 * Create a Status String for a proposal's finalisation status
 * @param {ProposalCache} cPropCache - The proposal cache to check
 * @returns {string} The string status, for display purposes
 */
function getProposalFinalisationStatus(cPropCache) {
    // Confirmations left until finalisation, by network consensus
    const nConfsLeft =
        cPropCache.nSubmissionHeight +
        cChainParams.current.proposalFeeConfirmRequirement -
        blockCount;

    if (cPropCache.nSubmissionHeight === 0 || blockCount === 0) {
        return translation.proposalFinalisationConfirming;
    } else if (nConfsLeft > 0) {
        return (
            nConfsLeft +
            ' block' +
            (nConfsLeft === 1 ? '' : 's') +
            ' ' +
            translation.proposalFinalisationRemaining
        );
    } else if (Math.abs(nConfsLeft) >= cChainParams.current.budgetCycleBlocks) {
        return translation.proposalFinalisationExpired;
    } else {
        return translation.proposalFinalisationReady;
    }
}

/**
 *
 * @param {Object} cProposal - A local proposal to add to the cache tracker
 * @returns {ProposalCache} - The finalisation cache object pointer of the local proposal
 */
function addProposalToFinalisationCache(cProposal) {
    // If it exists, return the existing cache
    /** @type ProposalCache */
    let cPropCache = arrProposalFinalisationCache.find(
        (a) => a.txid === cProposal.mpw.txid
    );
    if (cPropCache) return cPropCache;

    // Create a new cache
    cPropCache = {
        nSubmissionHeight: 0,
        txid: cProposal.mpw.txid,
        fFetching: false,
    };
    arrProposalFinalisationCache.push(cPropCache);

    // Return the object 'pointer' in the array for further updating
    return cPropCache;
}

/**
 * Render Governance proposal objects to a given Proposal category
 * @param {Array<object>} arrProposals - The proposals to render
 * @param {boolean} fContested - The proposal category
 */
async function renderProposals(arrProposals, fContested) {
    // Set the total budget
    doms.domTotalGovernanceBudget.innerText = (
        cChainParams.current.maxPayment / COIN
    ).toLocaleString('en-gb');

    // Update total budget in user's currency
    const nPrice = cOracle.getCachedPrice(strCurrency);
    const nCurrencyValue = (cChainParams.current.maxPayment / COIN) * nPrice;
    const { nValue, cLocale } = optimiseCurrencyLocale(nCurrencyValue);
    doms.domTotalGovernanceBudgetValue.innerHTML =
        nValue.toLocaleString('en-gb', cLocale) +
        ' <span style="color:#7C1DEA;">' +
        strCurrency.toUpperCase() +
        '</span>';

    // Select the table based on the proposal category
    const domTable = fContested
        ? doms.domGovProposalsContestedTableBody
        : doms.domGovProposalsTableBody;

    // Render the proposals in the relevent table
    const database = await Database.getInstance();
    const cMasternode = await database.getMasternode();

    if (!fContested) {
        const localProposals =
            (await database.getAccount())?.localProposals?.map((p) => {
                return {
                    Name: p.name,
                    URL: p.url,
                    PaymentAddress: p.address,
                    MonthlyPayment: p.monthlyPayment / COIN,
                    RemainingPaymentCount: p.nPayments,
                    TotalPayment: p.nPayments * (p.monthlyPayment / COIN),
                    Yeas: 0,
                    Nays: 0,
                    local: true,
                    Ratio: 0,
                    IsEstablished: false,
                    mpw: p,
                };
            }) || [];
        arrProposals = localProposals.concat(arrProposals);
    }
    arrProposals = await Promise.all(
        arrProposals.map(async (p) => {
            return {
                YourVote:
                    cMasternode && p.Hash
                        ? await cMasternode.getVote(p.Name, p.Hash)
                        : null,
                ...p,
            };
        })
    );

    // Fetch the Masternode count for proposal status calculations
    const cMasternodes = await getNetwork().getMasternodeCount();

    let totalAllocatedAmount = 0;

    // Wipe the current table and start rendering proposals
    let i = 0;
    domTable.innerHTML = '';
    for (const cProposal of arrProposals) {
        const domRow = domTable.insertRow();

        const domStatus = domRow.insertCell();
        domStatus.classList.add('governStatusCol');
        if (!fContested) {
            domStatus.setAttribute(
                'onclick',
                `if(document.getElementById('governMob${i}').classList.contains('d-none')) { document.getElementById('governMob${i}').classList.remove('d-none'); } else { document.getElementById('governMob${i}').classList.add('d-none'); }`
            );
        } else {
            domStatus.setAttribute(
                'onclick',
                `if(document.getElementById('governMobCon${i}').classList.contains('d-none')) { document.getElementById('governMobCon${i}').classList.remove('d-none'); } else { document.getElementById('governMobCon${i}').classList.add('d-none'); }`
            );
        }

        // Add border radius to last row
        if (arrProposals.length - 1 === i) {
            domStatus.classList.add('bblr-7p');
        }

        // Net Yes calculation
        const { Yeas, Nays } = cProposal;
        const nNetYes = Yeas - Nays;
        const nNetYesPercent = (nNetYes / cMasternodes.enabled) * 100;

        // Proposal Status calculation
        const nRequiredVotes = cMasternodes.enabled / 10;
        const nMonthlyPayment = parseInt(cProposal.MonthlyPayment);

        // Initial state is assumed to be "Not enough votes"
        let strStatus = translation.proposalFailing;
        let strFundingStatus = translation.proposalNotFunded;
        let strColourClass = 'No';

        // Proposal Status calculations
        if (nNetYes < nRequiredVotes) {
            // Scenario 1: Not enough votes, default scenario
        } else if (!cProposal.IsEstablished) {
            // Scenario 2: Enough votes, but not established
            strFundingStatus = translation.proposalTooYoung;
        } else if (
            nMonthlyPayment + totalAllocatedAmount >
            cChainParams.current.maxPayment / COIN
        ) {
            // Scenario 3: Enough votes, and established, but over-allocating the budget
            strStatus = translation.proposalPassing;
            strFundingStatus = translation.proposalOverBudget;
            strColourClass = 'OverAllocated';
        } else {
            // Scenario 4: Enough votes, and established
            strStatus = translation.proposalPassing;
            strFundingStatus = translation.proposalFunded;
            strColourClass = 'Yes';

            // Allocate this with the budget
            totalAllocatedAmount += nMonthlyPayment;
        }

        // Funding Status and allocation calculations
        if (cProposal.local) {
            // Check the finalisation cache
            const cPropCache = addProposalToFinalisationCache(cProposal);
            if (!cPropCache.fFetching) {
                waitForSubmissionBlockHeight(cPropCache).then(
                    updateGovernanceTab
                );
            }
            const strLocalStatus = getProposalFinalisationStatus(cPropCache);
            const finalizeButton = document.createElement('button');
            finalizeButton.className = 'pivx-button-small ';
            finalizeButton.innerHTML = '<i class="fas fa-check"></i>';

            if (
                strLocalStatus === translation.proposalFinalisationReady ||
                strLocalStatus === translation.proposalFinalisationExpired
            ) {
                finalizeButton.addEventListener('click', async () => {
                    const result = await Masternode.finalizeProposal(
                        cProposal.mpw
                    );

                    const deleteProposal = async () => {
                        // Fetch Account
                        const account = await database.getAccount();

                        // Find index of Account local proposal to remove
                        const nProposalIndex = account.localProposals.findIndex(
                            (p) => p.txid === cProposal.mpw.txid
                        );

                        // If found, remove the proposal and update the account with the modified localProposals array
                        if (nProposalIndex > -1) {
                            // Remove our proposal from it
                            account.localProposals.splice(nProposalIndex, 1);

                            // Update the DB
                            await database.updateAccount(account, true);
                        }
                    };

                    if (result.ok) {
                        deleteProposal();
                        // Create a prompt showing the finalisation success, vote hash, and further details
                        confirmPopup({
                            title: translation.PROPOSAL_FINALISED + ' 🚀',
                            html: `<p><span style="opacity: 0.65; margin: 10px;">${
                                translation.popupProposalFinalisedNote
                            }</span><br><br>${
                                translation.popupProposalVoteHash
                            }<br><span class="mono" style="font-size: small;">${sanitizeHTML(
                                result.hash
                            )}</span><br><br>${
                                translation.popupProposalFinalisedSignoff
                            } 👋</p>`,
                            hideConfirm: true,
                        });
                        updateGovernanceTab();
                    } else {
                        if (result.err === 'unconfirmed') {
                            createAlert(
                                'warning',
                                ALERTS.PROPOSAL_UNCONFIRMED,
                                5000
                            );
                        } else if (result.err === 'invalid') {
                            createAlert(
                                'warning',
                                ALERTS.PROPOSAL_EXPIRED,
                                5000
                            );
                            deleteProposal();
                            updateGovernanceTab();
                        } else {
                            createAlert(
                                'warning',
                                ALERTS.PROPOSAL_FINALISE_FAIL
                            );
                        }
                    }
                });
            } else {
                finalizeButton.style.opacity = 0.5;
                finalizeButton.style.cursor = 'default';
            }

            domStatus.innerHTML = `
            <span style="font-size:12px; line-height: 15px; display: block; margin-bottom:15px;">
                <span style="color:#fff; font-weight:700;">${strLocalStatus}</span><br>
            </span>
            <span class="governArrow for-mobile ptr">
                <i class="fa-solid fa-angle-down"></i>
            </span>`;
            domStatus.appendChild(finalizeButton);
        } else {
            domStatus.innerHTML = `
            <span style="text-transform:uppercase; font-size:12px; line-height: 15px; display: block; margin-bottom:15px;">
                <span style="font-weight:700;" class="votes${strColourClass}">${strStatus}</span><br>
                <span style="color:#9482b1;">(${strFundingStatus})</span><br>
            </span>
            <span style="font-size:12px; line-height: 15px; display: block; color:#9482b1;">
                <b style="color:#e9deff;">${nNetYesPercent.toFixed(1)}%</b><br>
                ${translation.proposalNetYes}
            </span>
            <span class="governArrow for-mobile ptr">
                <i class="fa-solid fa-angle-down"></i>
            </span>`;
        }

        // Name, Payment Address and URL hyperlink
        const domNameAndURL = domRow.insertCell();
        domNameAndURL.style = 'vertical-align: middle;';

        // IMPORTANT: Sanitise all of our HTML or a rogue server or malicious proposal could perform a cross-site scripting attack
        domNameAndURL.innerHTML = `<a class="governLink" style="color: white" href="${sanitizeHTML(
            cProposal.URL
        )}" target="_blank" rel="noopener noreferrer"><b>${sanitizeHTML(
            cProposal.Name
        )} <span class="governLinkIco"><i class="fa-solid fa-arrow-up-right-from-square"></i></b></a></span><br>
        <a class="governLink" style="border-radius: 8px; background-color:#1A122D; padding: 6px 9px; font-size: 14px; color:#861ff7;" onclick="MPW.openExplorer('${
            cProposal.PaymentAddress
        }')"><i class="fa-solid fa-user-large" style="margin-right: 5px"></i><b>${sanitizeHTML(
            cProposal.PaymentAddress.slice(0, 10) + '...'
        )}`;

        // Convert proposal amount to user's currency
        const nProposalValue = nMonthlyPayment * nPrice;
        const { nValue } = optimiseCurrencyLocale(nProposalValue);
        const strProposalCurrency = nValue.toLocaleString('en-gb', cLocale);

        // Payment Schedule and Amounts
        const domPayments = domRow.insertCell();
        domPayments.classList.add('for-desktop');
        domPayments.style = 'vertical-align: middle;';
        domPayments.innerHTML = `<span class="governValues"><b>${sanitizeHTML(
            nMonthlyPayment.toLocaleString('en-gb', ',', '.')
        )}</b> <span class="governMarked">${
            cChainParams.current.TICKER
        }</span> <br>
        <b class="governFiatSize">${strProposalCurrency} <span style="color:#7C1DEA;">${strCurrency.toUpperCase()}</span></b></span>

        <span class="governInstallments"> ${sanitizeHTML(
            cProposal['RemainingPaymentCount']
        )} ${
            translation.proposalPaymentsRemaining
        } <span style="font-weight:500;">${sanitizeHTML(
            parseInt(cProposal.TotalPayment).toLocaleString('en-gb', ',', '.')
        )} ${cChainParams.current.TICKER}</span> ${
            translation.proposalPaymentTotal
        }</span>`;

        // Vote Counts and Consensus Percentages
        const domVoteCounters = domRow.insertCell();
        domVoteCounters.classList.add('for-desktop');
        domVoteCounters.style = 'vertical-align: middle;';

        const nLocalPercent = cProposal.Ratio * 100;
        domVoteCounters.innerHTML = `<b>${parseFloat(
            nLocalPercent
        ).toLocaleString(
            'en-gb',
            { minimumFractionDigits: 0, maximumFractionDigits: 1 },
            ',',
            '.'
        )}%</b> <br>
        <small class="votesBg"> <b><div class="votesYes" style="display:inline;"> ${sanitizeHTML(
            Yeas
        )} </div></b> /
        <b><div class="votesNo" style="display:inline;"> ${sanitizeHTML(
            Nays
        )} </div></b></small>
        `;

        // Voting Buttons for Masternode owners (MNOs)
        let voteBtn;
        if (cProposal.local) {
            const domVoteBtns = domRow.insertCell();
            domVoteBtns.classList.add('for-desktop');
            domVoteBtns.style = 'vertical-align: middle;';
            voteBtn = '';
        } else {
            let btnYesClass = 'pivx-button-small govYesBtnMob';
            let btnNoClass =
                'pivx-button-outline pivx-button-outline-small govNoBtnMob';
            if (cProposal.YourVote) {
                if (cProposal.YourVote === 1) {
                    btnYesClass += ' pivx-button-big-yes-gov';
                } else {
                    btnNoClass += ' pivx-button-big-no-gov';
                }
            }

            const domVoteBtns = domRow.insertCell();
            domVoteBtns.style =
                'padding-top: 30px; vertical-align: middle; display: flex; justify-content: center; align-items: center;';
            const domNoBtn = document.createElement('div');
            domNoBtn.className = btnNoClass;
            domNoBtn.style.width = 'fit-content';
            domNoBtn.innerHTML = `<span>${translation.no}</span>`;
            domNoBtn.onclick = () => govVote(cProposal.Hash, 2);

            const domYesBtn = document.createElement('button');
            domYesBtn.className = btnYesClass;
            domYesBtn.innerText = translation.yes;
            domYesBtn.onclick = () => govVote(cProposal.Hash, 1);

            // Add border radius to last row
            if (arrProposals.length - 1 === i) {
                domVoteBtns.classList.add('bbrr-7p');
            }

            domVoteBtns.classList.add('for-desktop');
            domVoteBtns.appendChild(domNoBtn);
            domVoteBtns.appendChild(domYesBtn);

            domNoBtn.setAttribute(
                'onclick',
                `MPW.govVote('${cProposal.Hash}', 2)`
            );
            domYesBtn.setAttribute(
                'onclick',
                `MPW.govVote('${cProposal.Hash}', 1);`
            );

            domYesBtn.setAttribute('style', `height:36px;`);
            voteBtn = domNoBtn.outerHTML + domYesBtn.outerHTML;
        }

        // Create extended row for mobile
        const mobileDomRow = domTable.insertRow();
        const mobileExtended = mobileDomRow.insertCell();
        mobileExtended.style = 'vertical-align: middle;';
        if (!fContested) {
            mobileExtended.id = `governMob${i}`;
        } else {
            mobileExtended.id = `governMobCon${i}`;
        }
        mobileExtended.colSpan = '2';
        mobileExtended.classList.add('text-left');
        mobileExtended.classList.add('d-none');
        mobileExtended.classList.add('for-mobile');
        mobileExtended.innerHTML = `
        <div class="row pt-2">
            <div class="col-5 fs-13 fw-600">
                ${translation.govTablePayment}
            </div>
            <div class="col-7">
                <span class="governValues"><b>${sanitizeHTML(
                    nMonthlyPayment.toLocaleString('en-gb', ',', '.')
                )}</b> <span class="governMarked">${
            cChainParams.current.TICKER
        }</span> <span style="margin-left:10px; margin-right: 2px;" class="governMarked governFiatSize">${strProposalCurrency}</span></b></span>
        
                <span class="governInstallments"> ${sanitizeHTML(
                    cProposal['RemainingPaymentCount']
                )} ${translation.proposalPaymentsRemaining} <b>${sanitizeHTML(
            parseInt(cProposal.TotalPayment).toLocaleString('en-gb', ',', '.')
        )} ${cChainParams.current.TICKER}</b> ${
            translation.proposalPaymentTotal
        }</span>
            </div>
        </div>
        <hr class="governHr">
        <div class="row">
            <div class="col-5 fs-13 fw-600">
                ${translation.govTableVotes}
            </div>
            <div class="col-7">
                <b>${parseFloat(nLocalPercent).toLocaleString(
                    'en-gb',
                    { minimumFractionDigits: 0, maximumFractionDigits: 1 },
                    ',',
                    '.'
                )}%</b>
                <small class="votesBg"> <b><div class="votesYes" style="display:inline;"> ${sanitizeHTML(
                    Yeas
                )} </div></b> /
                <b><div class="votesNo" style="display:inline;"> ${sanitizeHTML(
                    Nays
                )} </div></b></small>
            </div>
        </div>
        <hr class="governHr">
        <div class="row pb-2">
            <div class="col-5 fs-13 fw-600">
                ${translation.govTableVote}
            </div>
            <div class="col-7 mobileVote">
                ${voteBtn}
            </div>
        </div>`;

        i++;
    }

    // Show allocated budget
    if (!fContested) {
        const strAlloc = sanitizeHTML(
            totalAllocatedAmount.toLocaleString('en-gb')
        );
        doms.domAllocatedGovernanceBudget.innerHTML = strAlloc;
        doms.domAllocatedGovernanceBudget2.innerHTML = strAlloc;

        // Update allocated budget in user's currency
        const nCurrencyValue = totalAllocatedAmount * nPrice;
        const { nValue } = optimiseCurrencyLocale(nCurrencyValue);
        const strAllocCurrency =
            nValue.toLocaleString('en-gb', cLocale) +
            ' <span style="color:#7C1DEA;">' +
            strCurrency.toUpperCase() +
            '</span>';
        doms.domAllocatedGovernanceBudgetValue.innerHTML = strAllocCurrency;
        doms.domAllocatedGovernanceBudgetValue2.innerHTML = strAllocCurrency;
    }
}

export async function updateMasternodeTab() {
    //TODO: IN A FUTURE ADD MULTI-MASTERNODE SUPPORT BY SAVING MNs with which you logged in the past.
    // Ensure a wallet is loaded
    doms.domMnTextErrors.innerHTML = '';
    doms.domAccessMasternode.style.display = 'none';
    doms.domCreateMasternode.style.display = 'none';
    doms.domMnDashboard.style.display = 'none';

    if (!wallet.isLoaded()) {
        doms.domMnTextErrors.innerHTML =
            'Please ' +
            ((await hasEncryptedWallet()) ? 'unlock' : 'import') +
            ' your <b>COLLATERAL WALLET</b> first.';
        return;
    }

    if (!wallet.isSynced) {
        doms.domMnTextErrors.innerHTML =
            'Your wallet is empty or still loading, re-open the tab in a few seconds!';
        return;
    }

    const database = await Database.getInstance();

    let cMasternode = await database.getMasternode();
    // If the collateral is missing (spent, or switched wallet) then remove the current MN
    if (cMasternode) {
        if (
            !wallet.isCoinLocked(
                new COutpoint({
                    txid: cMasternode.collateralTxId,
                    n: cMasternode.outidx,
                })
            )
        ) {
            database.removeMasternode();
            cMasternode = null;
        }
    }

    doms.domControlMasternode.style.display = cMasternode ? 'block' : 'none';

    // first case: the wallet is not HD and it is not hardware, so in case the wallet has collateral the user can check its status and do simple stuff like voting
    if (!wallet.isHD()) {
        doms.domMnAccessMasternodeText.innerHTML =
            doms.masternodeLegacyAccessText;
        doms.domMnTxId.style.display = 'none';
        // Find the first UTXO matching the expected collateral size
        const cCollaUTXO = wallet.getMasternodeUTXOs()[0];

        const balance = wallet.balance;
        if (cMasternode) {
            await refreshMasternodeData(cMasternode);
            doms.domMnDashboard.style.display = '';
        } else if (cCollaUTXO) {
            doms.domMnTxId.style.display = 'none';
            doms.domAccessMasternode.style.display = 'block';
        } else if (balance < cChainParams.current.collateralInSats) {
            // The user needs more funds
            doms.domMnTextErrors.innerHTML =
                'You need <b>' +
                (cChainParams.current.collateralInSats - balance) / COIN +
                ' more ' +
                cChainParams.current.TICKER +
                '</b> to create a Masternode!';
        } else {
            // The user has the funds, but not an exact collateral, prompt for them to create one
            doms.domCreateMasternode.style.display = 'flex';
            doms.domMnTxId.style.display = 'none';
            doms.domMnTxId.innerHTML = '';
        }
    } else {
        doms.domMnTxId.style.display = 'none';
        doms.domMnTxId.innerHTML = '';
        doms.domMnAccessMasternodeText.innerHTML = doms.masternodeHDAccessText;

        // First UTXO for each address in HD
        const mapCollateralPath = new Map();

        // Aggregate all valid Masternode collaterals into a map of Path <--> Collateral
        for (const cUTXO of wallet.getMasternodeUTXOs()) {
            mapCollateralPath.set(wallet.getPath(cUTXO.script), cUTXO);
        }
        const fHasCollateral = mapCollateralPath.size > 0;
        // If there's no loaded MN, but valid collaterals, display the configuration screen
        if (!cMasternode && fHasCollateral) {
            doms.domMnTxId.style.display = 'block';
            doms.domAccessMasternode.style.display = 'block';

            for (const [key] of mapCollateralPath) {
                const option = document.createElement('option');
                option.value = key;
                option.innerText = wallet.getAddressFromPath(key);
                doms.domMnTxId.appendChild(option);
            }
        }

        // If there's no collateral found, display the creation UI
        if (!fHasCollateral && !cMasternode)
            doms.domCreateMasternode.style.display = 'flex';

        // If we a loaded Masternode, display the Dashboard
        if (cMasternode) {
            // Refresh the display
            refreshMasternodeData(cMasternode);
            doms.domMnDashboard.style.display = '';
        }
    }
}

async function refreshMasternodeData(cMasternode, fAlert = false) {
    const cMasternodeData = await cMasternode.getFullData();

    debugLog(DebugTopics.GLOBAL, ' ---- NEW MASTERNODE DATA (Debug Mode) ----');
    debugLog(DebugTopics.GLOBAL, cMasternodeData);
    debugLog(DebugTopics.GLOBAL, '---- END MASTERNODE DATA (Debug Mode) ----');

    // If we have MN data available, update the dashboard
    if (cMasternodeData && cMasternodeData.status !== 'MISSING') {
        doms.domMnTextErrors.innerHTML = '';
        doms.domMnProtocol.innerText = `(${sanitizeHTML(
            cMasternodeData.version
        )})`;
        doms.domMnStatus.innerText = sanitizeHTML(cMasternodeData.status);
        doms.domMnNetType.innerText = sanitizeHTML(
            cMasternodeData.network.toUpperCase()
        );
        doms.domMnNetIP.innerText = cMasternode.addr;
        doms.domMnLastSeen.innerText = new Date(
            cMasternodeData.lastseen * 1000
        ).toLocaleTimeString();
    }

    if (cMasternodeData.status === 'MISSING') {
        doms.domMnTextErrors.innerHTML =
            'Masternode is currently <b>OFFLINE</b>';
        if (
            wallet.isHardwareWallet() ||
            !wallet.isViewOnly() ||
            (await restoreWallet(translation.walletUnlockCreateMN))
        ) {
            createAlert('warning', ALERTS.MN_OFFLINE_STARTING, 6000);
            // try to start the masternode
            const started = await cMasternode.start();
            if (started) {
                doms.domMnTextErrors.innerHTML = ALERTS.MN_STARTED;
                createAlert('success', ALERTS.MN_STARTED_ONLINE_SOON, 6000);
                const database = await Database.getInstance();
                await database.addMasternode(cMasternode);
                wallet.lockCoin(
                    new COutpoint({
                        txid: cMasternode.collateralTxId,
                        n: cMasternode.outidx,
                    })
                );
            } else {
                doms.domMnTextErrors.innerHTML = ALERTS.MN_START_FAILED;
                createAlert('warning', ALERTS.MN_START_FAILED, 6000);
            }
        }
    } else if (
        cMasternodeData.status === 'ENABLED' ||
        cMasternodeData.status === 'PRE_ENABLED'
    ) {
        if (fAlert)
            createAlert(
                'success',
                `${ALERTS.MN_STATUS_IS} <b> ${sanitizeHTML(
                    cMasternodeData.status
                )} </b>`,
                6000
            );
        const database = await Database.getInstance();
        await database.addMasternode(cMasternode);
        wallet.lockCoin(
            new COutpoint({
                txid: cMasternode.collateralTxId,
                n: cMasternode.outidx,
            })
        );
    } else if (cMasternodeData.status === 'REMOVED') {
        const state = cMasternodeData.status;
        doms.domMnTextErrors.innerHTML = tr(ALERTS.MN_STATE, [
            { state: state },
        ]);
        if (fAlert)
            createAlert(
                'warning',
                tr(ALERTS.MN_STATE, [{ state: state }]),
                6000
            );
    } else {
        // connection problem
        doms.domMnTextErrors.innerHTML = ALERTS.MN_CANT_CONNECT;
        if (fAlert) createAlert('warning', ALERTS.MN_CANT_CONNECT, 6000);
    }

    // Return the data in case the caller needs additional context
    return cMasternodeData;
}

export async function createProposal() {
    // Must have a wallet
    if (!wallet.isLoaded()) {
        return createAlert('warning', ALERTS.PROPOSAL_IMPORT_FIRST, 4500);
    }
    // Wallet must be encrypted
    if (!(await hasEncryptedWallet())) {
        return createAlert(
            'warning',
            tr(translation.popupProposalEncryptFirst, [
                { button: translation.secureYourWallet },
            ]),
            4500
        );
    }
    // Wallet must be unlocked
    if (
        wallet.isViewOnly() &&
        !(await restoreWallet(translation.walletUnlockProposal))
    ) {
        return;
    }
    // Must have enough funds
    if (wallet.balance * COIN < cChainParams.current.proposalFee) {
        return createAlert('warning', ALERTS.PROPOSAL_NOT_ENOUGH_FUNDS, 4500);
    }

    // Create the popup, wait for the user to confirm or cancel
    const fConfirmed = await confirmPopup({
        title: `<h4>${translation.popupCreateProposal}</h4>
        <span style="color: #af9cc6; font-size: 1rem; margin-bottom: 23px; display: block;">${
            translation.popupCreateProposalCost
        } <b>${cChainParams.current.proposalFee / COIN} ${
            cChainParams.current.TICKER
        }</b></span>`,
        html: `<div style="padding-left: 10px; padding-right: 10px;">
            <p style="margin-bottom: 12px; color: #af9cc6; font-size: 1rem; font-weight: 500;">Proposal name</p>
            <input id="proposalTitle" maxlength="20" placeholder="${
                translation.popupProposalName
            }" style="text-align: start; margin-bottom: 25px;"><br>
            
            <p style="margin-bottom: 12px; color: #af9cc6; font-size: 1rem; font-weight: 500;">URL</p>
            <input id="proposalUrl" maxlength="64" placeholder="https://forum.pivx.org/..." style=" margin-bottom: 25px; text-align: start;"><br>
            
            <p style="margin-bottom: 12px; color: #af9cc6; font-size: 1rem; font-weight: 500;">Duration in cycles</p>
            <input type="number" id="proposalCycles" min="1" max="${
                cChainParams.current.maxPaymentCycles
            }" placeholder="${
            translation.popupProposalDuration
        }" style=" margin-bottom: 25px; text-align: start;"><br>
            
            <p style="margin-bottom: 12px; color: #af9cc6; font-size: 1rem; font-weight: 500;">${
                cChainParams.current.TICKER
            } per cycle</p>
            <input type="number" id="proposalPayment" min="10" max="${
                cChainParams.current.maxPayment / COIN
            }" placeholder="${cChainParams.current.TICKER} ${
            translation.popupProposalPerCycle
        }" style=" margin-bottom: 25px; text-align: start;">${
            !fAdvancedMode ? '<br>' : ''
        }
            
            <p style="margin-bottom: 12px; color: #af9cc6; font-size: 1rem; font-weight: 500; ${
                !fAdvancedMode ? 'display: none' : ''
            }">Proposal Address</p>
            <input id="proposalAddress" maxlength="34" placeholder="${
                translation.popupProposalAddress
            }" style=" margin-bottom: 25px; text-align: start; ${
            !fAdvancedMode ? 'display: none' : ''
        }">
        </div>`,
        wideModal: true,
    });

    // If the user cancelled, then we return
    if (!fConfirmed) return;

    const strTitle = document.getElementById('proposalTitle').value.trim();
    const strUrl = document.getElementById('proposalUrl').value.trim();
    const numCycles = parseInt(
        document.getElementById('proposalCycles').value.trim()
    );
    const numPayment = parseInt(
        document.getElementById('proposalPayment').value.trim()
    );

    // If Advanced Mode is enabled and an address is given, use the provided address, otherwise, generate a new one
    const strAddress =
        document.getElementById('proposalAddress').value.trim() ||
        wallet.getNewChangeAddress();
    const nextSuperblock = await getNetwork().getNextSuperblock();
    const proposal = {
        name: strTitle,
        url: strUrl,
        nPayments: numCycles,
        start: nextSuperblock,
        address: strAddress,
        monthlyPayment: numPayment * COIN,
    };

    const isValid = Masternode.isValidProposal(proposal);
    if (!isValid.ok) {
        createAlert(
            'warning',
            `${ALERTS.PROPOSAL_INVALID_ERROR} ${isValid.err}`,
            7500
        );
        return;
    }

    const hash = Masternode.createProposalHash(proposal);
    const { ok, txid } = await createAndSendTransaction({
        address: hash,
        amount: cChainParams.current.proposalFee,
        isProposal: true,
    });
    if (ok) {
        proposal.txid = txid;
        const database = await Database.getInstance();

        // Fetch our Account, add the proposal to it
        const account = await database.getAccount();
        account.localProposals.push(proposal);

        // Update the DB
        await database.updateAccount(account);
        createAlert('success', translation.PROPOSAL_CREATED, 10000);
        updateGovernanceTab();
    }
}

export async function refreshChainData() {
    const cNet = getNetwork();
    // Fetch block count
    const newBlockCount = await cNet.getBlockCount();
    if (newBlockCount !== blockCount) {
        blockCount = newBlockCount;
        getEventEmitter().emit('new-block', blockCount);
    }
}

// A safety mechanism enabled if the user attempts to leave without encrypting/saving their keys
export const beforeUnloadListener = (evt) => {
    evt.preventDefault();
    // Disable Save your wallet warning on unload
    createAlert('warning', ALERTS.SAVE_WALLET_PLEASE, 10000);
    // Most browsers ignore this nowadays, but still, keep it 'just incase'
    return (evt.returnValue = translation.BACKUP_OR_ENCRYPT_WALLET);
};

/**
 * @typedef {Object} SettingsDOM - An object that contains the DOM elements for settings pages.
 * @property {HTMLElement} btn - The button to switch to this setting type.
 * @property {HTMLElement} section - The container for this setting type.
 */

/**
 * Returns a list of all pages and their DOM elements.
 *
 * This must be a function, since, the DOM elements are `undefined` until
 * after the startup sequence.
 *
 * Types are inferred.
 */
function getSettingsPages() {
    return {
        /** @type {SettingsDOM} */
        wallet: {
            btn: doms.domWalletSettingsBtn,
            section: doms.domWalletSettings,
        },
        /** @type {SettingsDOM} */
        display: {
            btn: doms.domDisplaySettingsBtn,
            section: doms.domDisplaySettings,
        },
    };
}

/**
 * Switch between screens in the settings menu
 * @param {string} page - The name of the setting page to switch to
 */
export function switchSettings(page) {
    const SETTINGS = getSettingsPages();
    const { btn, section } = SETTINGS[page];

    Object.values(SETTINGS).forEach(({ section, btn }) => {
        // Set the slider to the proper location
        if (page === 'display') {
            doms.domDisplayDecimalsSlider.oninput = function () {
                doms.domDisplayDecimalsSliderDisplay.innerHTML = this.value;
                //let val =  ((((doms.domDisplayDecimalsSlider.offsetWidth - 24) / 9) ) * parseInt(this.value));

                //doms.domDisplayDecimalsSliderDisplay.style.marginLeft = (val) + 'px';
            };

            // Triggers the input event
            setTimeout(
                () =>
                    doms.domDisplayDecimalsSlider.dispatchEvent(
                        new Event('input')
                    ),
                10
            );
        }
        // Hide all settings sections
        section.classList.add('d-none');
        // Make all buttons inactive
        btn.classList.remove('active');
    });

    // Show selected section and make its button active
    section.classList.remove('d-none');
    btn.classList.add('active');
}

function errorHandler(e) {
    const message = `${translation.unhandledException} <br> ${sanitizeHTML(
        e.message || e.reason
    )}`;
    try {
        createAlert('warning', message);
    } catch (_) {
        // Something as gone wrong, so we fall back to the default alert
        // This can happen on early errors for example
        alert(message);
    }
}

// This code is ran in the vanity gen worker as well!
// In which case, window would be not defined.
// `if (window)` wouldn't work either because
// window is not defined as opposed to undefined
try {
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', errorHandler);
} catch (_) {}
