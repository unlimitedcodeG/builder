import { AssetBase, asset } from "@/interface/asset";
import { isInstance } from "@/util/class";

/**
 * @class Sound
 * 
 * @author tgb
 * @createDate 2024-01-11
 */

export default class Sound extends AssetBase implements asset {
    /**
     * The root path of the sounds.
     */
    static ROOT_PATH = "assets/sounds/"

    /**
     * The regular expression of the sound.
     */
    static REG_EXP = new RegExp(`^${Sound.ROOT_PATH}(.+)/(.+)$`);

    /**
     * The name of the sound.
     */
    name: string;

    /**
     * The files of the sound.
     */
    files: File[];

    /**
     * The config of the sound.
     */
    config: Record<string, any>;

    /**
     * @constructor create a new sound
     * @param {string} name the name of the sound
     * @param {File[]} files the files of the sound
     * @param {Record<string, any>} config the config of the sound using json to generate `index.json`
     */
    constructor(name: string, files: File[] = [], config: Record<string, any> = {}) {
        super()
        this.name = name
        this.files = files
        this.config = config
    }

    /**
     * Get the directory of the sound.
     */
    get dir() {
        const dir: Record<string, any> = {}
        dir[`${this.path}/index.json`] = this.config
        for (const file of this.files) {
            dir[`${this.path}/${file.name}`] = file
        }
        return dir
    }

    /**
     * Get the path of the sound.
     */
    get path() {
        return Sound.ROOT_PATH + this.name
    }

    /**
     * Check if an object is an instance of a sound.
     */
    static isInstance(obj: any): boolean {
        return isInstance(obj, Sound);
    }
}