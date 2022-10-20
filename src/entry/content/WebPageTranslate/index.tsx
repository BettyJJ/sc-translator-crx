import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import ErrorMessage from '../../../components/ErrorMessage';
import IconFont from '../../../components/IconFont';
import LanguageSelect from '../../../components/LanguageSelect';
import PanelIconButtonWrapper from '../../../components/PanelIconButtons/PanelIconButtonWrapper';
import SourceSelect from '../../../components/SourceSelect';
import { SCTS_SWITCH_WT_DISPLAY_MODE, SCTS_TRANSLATE_CURRENT_PAGE } from '../../../constants/chromeSendMessageTypes';
import { LangCodes, preferredLangCode } from '../../../constants/langCode';
import { webPageTranslateSource as webPageTranslateSourceList } from '../../../constants/translateSource';
import { setLocalStorage } from '../../../public/chrome-call';
import { getMessage } from '../../../public/i18n';
import { getOptions } from '../../../public/options';
import { useOnRuntimeMessage, useOptions } from '../../../public/react-use';
import useEffectOnce from '../../../public/react-use/useEffectOnce';
import { closeWebPageTranslating, errorRetry, startWebPageTranslating, switchWayOfFontsDisplaying } from '../../../public/web-page-translate';
import { DefaultOptions } from '../../../types';
import './style.css';

const wPTI18nCache = {
    switchDisplayModeOfResult: getMessage('contentSwitchDisplayModeOfResult'),
    startWebPageTranslating: getMessage('contentStartWebPageTranslating'),
    closeWebPageTranslating: getMessage('contentCloseWebPageTranslating'),
    restartWebpageTranslating: getMessage('contentRestartWebpageTranslating'),
    enableAutoTranslationOnThisSite: getMessage('contentEnableAutoTranslationOnThisSite'),
    disableAutoTranslationOnThisSite: getMessage('contentDisableAutoTranslationOnThisSite')
};

// WPT means web page transalte
type WPTReducerState = {
    show: boolean;
    source: string;
    targetLanguage: string;
    working: boolean;
    error: string;
    activated: boolean;
    auto: boolean;
};
type WPTReducerAction = 
| { type: 'active-wpt'; show: boolean; auto: boolean; }
| { type: 'change-error'; error: string; }
| { type: 'process-success'; }
| { type: 'close-wpt'; }
| { type: 'change-source'; source: string; }
| { type: 'change-targer-language'; targetLanguage: string; }
| { type: 'show-control-bar'; }
| { type: 'hide-control-bar'; };

const initWPTState: WPTReducerState = {
    show: false,
    source: '',
    targetLanguage: '',
    working: false,
    error: '',
    activated: false,
    auto: false
};

const wPTReducer = (state: WPTReducerState, action: WPTReducerAction): WPTReducerState => {
    switch (action.type) {
        case 'active-wpt':
            return { ...state, show: action.show, error: '', working: false, activated: true, auto: action.auto };
        case 'change-error':
            return { ...state, error: action.error };
        case 'process-success':
            return { ...state, working: true };
        case 'close-wpt':
            return { ...state, show: false, working: false, activated: false, auto: false };
        case 'change-source':
            return { ...state, source: action.source };
        case 'change-targer-language':
            return { ...state, targetLanguage: action.targetLanguage };
        case 'show-control-bar':
            return { ...state, show: true };
        case 'hide-control-bar':
            return { ...state, show: false };
        default:
            return state;
    }
};

type PickedOptions = Pick<DefaultOptions, 'autoTranslateWebpageHostList'>;
const useOptionsDependency: (keyof PickedOptions)[] = ['autoTranslateWebpageHostList'];

const WebPageTranslate: React.FC = () => {
    const [langCodes, setLangCodes] = useState<LangCodes>([]);
    const [langLocal, setLangLocal] = useState<{ [key: string]: string; }>({});
    const [workingSourceAndLanguage, setWorkingSourceAndLanguage] = useState({ source: '', targetLanguage: '' });

    const [{ show, source, targetLanguage, working, error, activated, auto }, dispach] = useReducer(wPTReducer, {
        ...initWPTState,
        source: getOptions().webPageTranslateSource,
        targetLanguage: getOptions().webPageTranslateTo
    });

    const { autoTranslateWebpageHostList } = useOptions<PickedOptions>(useOptionsDependency);

    const hostSet = useMemo(() => {
        return new Set(autoTranslateWebpageHostList);
    }, [autoTranslateWebpageHostList]);

    const host = window.location.host;

    const handleError = useCallback((errorReason: string) => {
        errorReason && dispach({ type: 'change-error', error: errorReason });
    }, [dispach]);

    useEffectOnce(() => {
        switchWayOfFontsDisplaying(getOptions().webPageTranslateDisplayMode);

        const auto = getOptions().enableAutoTranslateWebpage && getOptions().autoTranslateWebpageHostList.includes(host);

        if (!working && auto) {
            dispach({ type: 'active-wpt', show: !getOptions().noControlBarWhileFirstActivating, auto });

            startProcessing();
        }
    });

    useEffect(() => {
        setLangCodes(preferredLangCode[getOptions().userLanguage]);

        setLangLocal(preferredLangCode[getOptions().userLanguage].reduce((total: { [key: string]: string; }, current) => {
            total[current['code']] = current['name'];
            return total;
        }, {}));
    }, [source]);

    const startProcessing = useCallback((force = false) => {
        if (source === workingSourceAndLanguage.source && targetLanguage === workingSourceAndLanguage.targetLanguage && !force) { return; }

        closeWebPageTranslating();

        const startSuccess = startWebPageTranslating({
            element: document.body,
            translateSource: source,
            targetLanguage,
            enhancement: getOptions().displayModeEnhancement,
            translateDynamicContent: getOptions().translateDynamicContent,
            onError: handleError
        });

        if (startSuccess) {
            setWorkingSourceAndLanguage({ source, targetLanguage });
            dispach({ type: 'process-success' });
        }
        else {
            dispach({ type: 'change-error', error: 'Process failed!' });
        }
    }, [source, targetLanguage, workingSourceAndLanguage, dispach, handleError]);

    useOnRuntimeMessage(({ type }) => {
        switch (type) {
            case SCTS_TRANSLATE_CURRENT_PAGE:
                if (!working) {
                    dispach({ type: 'active-wpt', show: !(getOptions().webPageTranslateDirectly && getOptions().noControlBarWhileFirstActivating), auto: false });

                    getOptions().webPageTranslateDirectly && startProcessing();
                }

                if (!activated) { break; }

                if (!show) {
                    dispach({ type: 'show-control-bar' });
                    break;
                }

                if ((getOptions().webPageTranslateDirectly || auto) && getOptions().noControlBarWhileFirstActivating) {
                    dispach({ type: 'hide-control-bar' });
                }

                break;
            case SCTS_SWITCH_WT_DISPLAY_MODE:
                working && switchWayOfFontsDisplaying();
                break;
            default: break;
        }
    });

    return (<div className='web-page-translate'
        style={show ? {} : {display: 'none'}}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
    >
        {error && <div className='web-page-translate__error'>
            <ErrorMessage
                errorCode={error}
                retry={() => {
                    errorRetry();
                    dispach({ type: 'change-error', error: '' });
                }}
            />
        </div>}
        <div className='web-page-translate__content flex-align-items-center'>
            <SourceSelect
                className='web-page-translate__select border-bottom-select'
                source={source}
                sourceList={webPageTranslateSourceList.concat(getOptions().customWebpageTranslateSourceList)}
                onChange={source => dispach({ type: 'change-source', source })}
            />
            <LanguageSelect
                className='web-page-translate__select border-bottom-select'
                value={targetLanguage}
                langCodes={langCodes}
                langLocal={langLocal}
                onChange={targetLanguage => dispach({ type: 'change-targer-language', targetLanguage })}
                recentLangs={[]}
            />
            <PanelIconButtonWrapper
                onClick={() => {
                    if (!working) { return; }

                    switchWayOfFontsDisplaying();
                }}
                disabled={!working}
                title={wPTI18nCache.switchDisplayModeOfResult}
            >
                <IconFont iconName='#icon-switch' />
            </PanelIconButtonWrapper>
            <PanelIconButtonWrapper
                onClick={startProcessing}
                disabled={source === workingSourceAndLanguage.source && targetLanguage === workingSourceAndLanguage.targetLanguage}
                title={wPTI18nCache.startWebPageTranslating}
            >
                <IconFont iconName='#icon-start' />
            </PanelIconButtonWrapper>
            <PanelIconButtonWrapper
                onClick={() => {
                    startProcessing(true);
                }}
                disabled={!working}
                title={wPTI18nCache.restartWebpageTranslating}
            >
                <IconFont iconName='#icon-refresh' />
            </PanelIconButtonWrapper>
            <PanelIconButtonWrapper
                onClick={() => {
                    const nextHostSet = new Set(hostSet);
                    nextHostSet.has(host) ? nextHostSet.delete(host) : nextHostSet.add(host);
                    setLocalStorage({ autoTranslateWebpageHostList: [...nextHostSet] });
                }}
                title={hostSet.has(host) ? wPTI18nCache.disableAutoTranslationOnThisSite : wPTI18nCache.enableAutoTranslationOnThisSite}
                iconGrey={!hostSet.has(host)}
            >
                <IconFont iconName='#icon-auto' />
            </PanelIconButtonWrapper>
            <PanelIconButtonWrapper
                onClick={() => {
                    closeWebPageTranslating();
                    setWorkingSourceAndLanguage({ source: '', targetLanguage: '' });
                    dispach({ type: 'close-wpt' });
                }}
                title={wPTI18nCache.closeWebPageTranslating}
            >
                <IconFont iconName='#icon-GoX' />
            </PanelIconButtonWrapper>
        </div>
    </div>);
};

export default WebPageTranslate;