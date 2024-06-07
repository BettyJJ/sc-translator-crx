import {
	GOOGLE_COM,
	BING_COM,
	MOJIDICT_COM,
	BAIDU_COM
} from '../constants/translateSource';
import google from '../public/translate/google';
import bing from '../public/translate/bing';
import mojidict from '../public/translate/mojidict';
import baidu from '../public/translate/baidu';
import custom from '../public/translate/custom';
import { bingSwitchLangCode, baiduSwitchLangCode, bingSwitchToGoogleLangCode, baiduSwitchToGoogleLangCode } from '../public/switch-lang-code';
import { AudioResponse, DetectResponse, TranslateResponse } from './send';
import { getError } from './translate/utils';

type TranslateRequestParams = {
	source: string;
	text: string;
	from: string;
	to: string;
	com: boolean;
	preferredLanguage: string;
	secondPreferredLanguage: string;
};

export const translate = async ({ source, ...requestParams }: TranslateRequestParams): Promise<TranslateResponse> => {
	let translate;

	switch (source) {
		case GOOGLE_COM:
			translate = google.translate;
			break;
		case BING_COM:
			translate = bing.translate;
			requestParams.from = bingSwitchLangCode(requestParams.from);
			requestParams.to = bingSwitchLangCode(requestParams.to);
			requestParams.preferredLanguage = bingSwitchLangCode(requestParams.preferredLanguage);
			requestParams.secondPreferredLanguage = bingSwitchLangCode(requestParams.secondPreferredLanguage);
			break;
		case MOJIDICT_COM:
			translate = mojidict.translate;
			break;
		case BAIDU_COM:
			translate = baidu.translate;
			requestParams.from = baiduSwitchLangCode(requestParams.from);
			requestParams.to = baiduSwitchLangCode(requestParams.to);
			requestParams.preferredLanguage = baiduSwitchLangCode(requestParams.preferredLanguage);
			requestParams.secondPreferredLanguage = baiduSwitchLangCode(requestParams.secondPreferredLanguage);
			break;
		default:
			translate = custom.translate;
			break;
	}
	
	try {
		const translation = await translate(requestParams, source);

		return { translation };
	}
	catch (err) {
		return { code: (err as ReturnType<typeof getError>).code };
	}
};

type AudioRequestParams = {
	source: string;
	text: string;
	from: string;
	com: boolean;
};

export const audio = async (requestParams: AudioRequestParams): Promise<AudioResponse> => {
	let audio;
	switch (requestParams.source) {
		case GOOGLE_COM:
			audio = google.audio;
			break;
		case BING_COM:
			audio = bing.audio;
			requestParams.from = bingSwitchLangCode(requestParams.from ?? '');
			break;
		case BAIDU_COM:
			audio = baidu.audio;
			requestParams.from = baiduSwitchLangCode(requestParams.from ?? '');
			break;
		default:
			audio = google.audio;
			break;
	}

	try {
		const dataUri = await audio(requestParams);
		
		return { dataUri };
	}
	catch (err) {
		return { code: (err as ReturnType<typeof getError>).code };
	}
};

type DetectRequestParams = {
	source: string;
	text: string;
	com: boolean;
};

export const detect = async (requestParams: DetectRequestParams): Promise<DetectResponse> => {
	let detect;
	switch (requestParams.source) {
		case GOOGLE_COM:
			detect = google.detect;
			break;
		case BING_COM:
			detect = bing.detect;
			break;
		case BAIDU_COM:
			detect = baidu.detect;
			break;
		default:
			detect = google.detect;
			break;
	}

	try {
		let langCode = await detect(requestParams);

		if (requestParams.source === BING_COM) {
			langCode = bingSwitchToGoogleLangCode(langCode);
		}
		else if (requestParams.source === BAIDU_COM) {
			langCode = baiduSwitchToGoogleLangCode(langCode);
		}

		return { langCode };
	}
	catch (err) {
		return { code: (err as ReturnType<typeof getError>).code };
	}
};