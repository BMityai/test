import LoggerService from "sosise-core/build/Services/Logger/LoggerService";
import LocalStorageRepositoryInterface from "../Repositories/LocalStorageRepositoryInterface";
import puppeteer from "puppeteer";
import EventEmitter from "events";
export default class ParserService {

    /**
     * LocalStorageRepositoryInterface
     */
    localStorageRepository: LocalStorageRepositoryInterface

    /**
     * LoggerService
     */
    loggerService: LoggerService

    /**
     * 
     * @param localStorageRepository 
     * @param loggerService 
     */
    constructor(localStorageRepository: LocalStorageRepositoryInterface, loggerService: LoggerService) {
        this.localStorageRepository = localStorageRepository;
        this.loggerService = loggerService;
        const emitter = new EventEmitter();
        emitter.setMaxListeners(100);
    }

    public async parse() {
        this.loggerService.info('start');
        const config = await this.localStorageRepository.getConfig();
        
        for (const chunk of this.arrayChunk(config)) {
            const contentPromise = new Array();

            for(const item of chunk as []) {
                
                contentPromise.push(this.getContent(item));
            }

            const getContentPromiseResult = await Promise.allSettled(contentPromise);

            const createOrUpdateContentPromise = new Array();
            for(const [key, response] of Object.entries(getContentPromiseResult)) {
                
                if(response.status !== 'fulfilled'){
                    this.loggerService.critical("Can't get content", response.reason);
                    continue;
                }

                createOrUpdateContentPromise.push(this.localStorageRepository.createOrUpdateContent(response.value))
            }

            const createOrUpdateContentPromiseResult = await Promise.allSettled(createOrUpdateContentPromise);
            
            for(const [key, response] of Object.entries(createOrUpdateContentPromiseResult)) {
                if(response.status !== 'fulfilled') {
                    this.loggerService.critical("Can't update", response.reason);
                    continue;
                }

            }
        }
    }

    private arrayChunk(inputArray: [], chunkSize: number = 20) {
        const res = [];
        for (let i = 0; i < inputArray.length; i += chunkSize) {
            const chunk = inputArray.slice(i, i + chunkSize);
            res.push(chunk as never);
        }
        return res;
    }

    /**
     * Get content
     */
    private async getContent(item) {
        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium-browser', //@todo uncomment before release
            args: ["--no-sandbox"]
        });

        try {
            const page = (await browser.pages())[0];
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en'
            });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36');

            await page.goto(item.url, {
                waitUntil: 'load',
            });
            await page.waitFor(4000)

            // this.loggerService.info(await page.content())
            var content = await page.$eval(item.selector, el => el.textContent);
            if (content) content = content.substr(1);

            if (content) content = content.replace(',', '');
            if (content) content = content.replace('.', ',');
            browser.close();
            return { id: item.id, content: content };
        } catch {
            browser.close();
        }



    }

    /**
     * 
     */
    protected async createOrUpdatePerItem(contents) {
        const createOrUpdatePromise = new Array();
        for (const content of contents) {
            if (content.status != 'fulfilled') continue;

            createOrUpdatePromise.push(this.localStorageRepository.createOrUpdateContent(content.value));
        }
        await Promise.allSettled(createOrUpdatePromise);
    }
}
