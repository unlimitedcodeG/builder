import { ref, computed, watch, toRaw, ComputedRef, WatchStopHandle, Ref, readonly } from 'vue'
import { getMimeFromExt, Content2ArrayBuffer, ArrayBuffer2Content } from '@/util/file'
import { defineStore, storeToRefs } from 'pinia'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import localForage from 'localforage'
import { useSoundStore } from '../sound'
import { useSpriteStore } from '../sprite'
import { useBackdropStore } from '../backdrop'
import Backdrop from '@/class/backdrop'
import Sprite from '@/class/sprite'
import Sound from '@/class/sound'
import type { projectType, dirPath, FileType } from '@/types/file'

const UNTITLED_NAME = 'Untitled'

export const useProjectStore = defineStore('project', () => {
    const spriteStore = useSpriteStore()
    // @ts-ignore
    // The type system is unable to recognize dynamic property names, which may lead to type errors during compilation.
    const { sprites }: { sprites: Ref<Sprite[]> } = storeToRefs(spriteStore)

    const soundStore = useSoundStore()
    // @ts-ignore
    // The type system is unable to recognize dynamic property names, which may lead to type errors during compilation.
    const { sounds }: { sounds: Ref<Sound[]> } = storeToRefs(soundStore)

    const backdropStore = useBackdropStore()
    const { backdrop } = storeToRefs(backdropStore)

    const title = ref(UNTITLED_NAME)
    const setTitle = (t: string) => {
        title.value = t
    }

    const defaultDir = ref<dirPath>({})
    const setDefaultDir = (d: dirPath) => {
        defaultDir.value = d
    }

    // @ts-ignore
    const project: ComputedRef<projectType> = computed(() => ({
        title: title.value,
        sprites: sprites.value,
        sounds: sounds.value,
        backdrop: backdrop.value,
        defaultDir: defaultDir.value
    }))

    /**
     * Convert project(computedRef) to raw object.
     * @returns {projectType} project
     */
    function getRawProject(): projectType {
        return Object.fromEntries(Object.entries(project.value).map(([k, v]) => [k, toRaw(v)])) as projectType
    }

    /**
     * Watch project and call callback when it changes.
     * @param {Function} fn 
     * @param {Boolean} deep
     * @returns {Function} stopWatch
     */
    function watchProjectChange(fn?: Function, deep: boolean = true, immediate: boolean = false): WatchStopHandle {
        return watch(project, (newVal, oldVal) => {
            fn && fn(newVal, oldVal)
        }, { deep, immediate })
    }

    /**
     * Add Sprite or Sound to project.
     * @param item 
     */
    function addItem(item: Sprite | Sound) {
        if (Sprite.isInstance(item)) {
            spriteStore.addItem(item as Sprite)
        } else if (Sound.isInstance(item)) {
            soundStore.addItem(item)
        }
    }

    /**
     * Set Sprite or Sound to project.
     * @param item 
     */
    function setItem(item: Sprite[] | Sound[] | Backdrop) {
        if (Sprite.isInstance(item)) {
            spriteStore.setItem(item as Sprite[])
        } else if (Sound.isInstance(item)) {
            soundStore.setItem(item as Sound[])
        } else if (Backdrop.isInstance(item)) {
            backdropStore.setItem(item as Backdrop)
        }
    }

    /**
     * Remove Sprite or Sound from project.
     * @param item 
     */
    function removeItem(item: Sprite | Sound) {
        if (item instanceof Sprite) {
            spriteStore.removeItemByRef(item)
        } else if (item instanceof Sound) {
            soundStore.removeItemByRef(item)
        }
    }

    /**
     * Save current project to local storage.
     */
    async function saveProject() {
        await removeProject(title.value)
        const dir = convertProjectToDirectory()
        const dirBuffer = await convertDirectoryToBuffer(dir)
        for (const [key, value] of Object.entries(dirBuffer)) {
            await localForage.setItem(key, value)
        }
    }

    /**
     * Remove project from local storage.
     * @param {string} name
     */
    async function removeProject(name: string) {
        const keys = await localForage.keys()
        const projectKeys = keys.filter(key => key.startsWith(name))
        for (const key of projectKeys) {
            await localForage.removeItem(key)
        }
    }

    /**
     * Convert project(computedRef) to directory object.
     * @returns {Record<string, any>} project
     */
    function convertProjectToDirectory(): Record<string, any> {
        const project = getRawProject();
        const files: Record<string, any> = Object.assign({}, project.defaultDir, ...[project.backdrop, ...project.sprites, ...project.sounds].map(item => item.dir))

        // if no entry in files, add main.spx as default
        if (!('main.spx' in files || 'index.spx' in files || 'index.gmx' in files || 'main.gmx' in files)) {
            files['main.spx'] = `var (\n\t${project.sprites.map(sprite => sprite.name + " " + sprite.name).join('\n\t')}\n\t${project.sounds?.map(sound => sound.name + ' Sound').join('\n\t')}\n)\n\nrun "assets", {Title: "${project.title}"}`
        }
        return files
    }

    /**
     * Convert directory object to ArrayBuffer.
     * @returns {dirPath} project
     */
    async function convertDirectoryToBuffer(dir: Record<string, any>): Promise<dirPath> {
        const directory: dirPath = {}

        for (const [path, value] of Object.entries(dir)) {
            const fullPath = project.value.title + '/' + path
            if (value.content && value.content instanceof ArrayBuffer) {
                directory[fullPath] = Object.assign(value, { path: fullPath })
                continue
            }
            const ext = path.split('.').pop()!
            const content = await Content2ArrayBuffer(value, getMimeFromExt(ext))
            directory[fullPath] = {
                content,
                path: fullPath,
                type: getMimeFromExt(ext),
                size: content.byteLength,
                modifyTime: new Date()
            }
        }

        return directory
    }

    /**
     * Reset project.
     */
    function resetProject() {
        backdropStore.setItem(new Backdrop())
        spriteStore.setItem([])
        soundStore.setItem([])
        setTitle(UNTITLED_NAME)
    }

    /**
     * Get directory from zip file.
     * @param {File} zipFile the zip file
     * @returns {Promise<dirPath>} the directory of the zip
     * 
     * @example
     * const dir = await getDirPathFromZip(zipFile)
     * loadProject(dir)
     */
    async function getDirPathFromZip(zipFile: File): Promise<dirPath> {
        const zip = await JSZip.loadAsync(zipFile);
        const projectName = zipFile.name.split('.')[0];
        const dir: dirPath = {};

        for (let [relativePath, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue
            const content = await zipEntry.async('arraybuffer')
            const path = projectName + '/' + relativePath
            const type = getMimeFromExt(relativePath.split('.').pop()!)
            const size = content.byteLength
            const modifyTime = zipEntry.date || new Date();
            dir[path] = {
                content,
                path,
                type,
                size,
                modifyTime
            }
        }
        return dir
    }

    /**
     * Parse directory to project.
     * @param {dirPath} dir
     * @returns {projectType} project
     */
    function parseProject(dir: dirPath): projectType {
        function handleFile(file: FileType, filename: string, item: any) {
            switch (file.type) {
                case 'application/json':
                    item.config = ArrayBuffer2Content(file.content, file.type) as Record<string, any>;
                    break;
                default:
                    item.files.push(ArrayBuffer2Content(file.content, file.type, filename) as File);
                    break;
            }
        }

        function findOrCreateItem(name: string, collection: any[], constructor: typeof Sprite | typeof Sound) {
            let item = collection.find(item => item.name === name);
            if (!item) {
                item = new constructor(name, []);
                collection.push(item);
            }
            return item;
        }

        const proj: projectType = {
            title: UNTITLED_NAME,
            sprites: [],
            sounds: [],
            backdrop: new Backdrop([]),
            defaultDir: {}
        };

        proj.title = Object.keys(dir).pop()?.split('/').shift() || UNTITLED_NAME

        for (let [path, file] of Object.entries(dir)) {
            const filename = file.path.split('/').pop()!;
            path = path.replace(proj.title + '/', '')
            if (Sprite.REG_EXP.test(path)) {
                const spriteName = path.match(Sprite.REG_EXP)?.[1] || '';
                const sprite: Sprite = findOrCreateItem(spriteName, proj.sprites, Sprite);
                handleFile(file, filename, sprite);
            }
            else if (!path.includes('main.spx') && /^.+\.spx$/.test(path)) {
                const spriteName = path.match(/^(.+)\.spx$/)?.[1] || '';
                const sprite: Sprite = findOrCreateItem(spriteName, proj.sprites, Sprite);
                sprite.code = ArrayBuffer2Content(file.content, file.type) as string;
            }
            else if (Sound.REG_EXP.test(path)) {
                const soundName = path.match(Sound.REG_EXP)?.[1] || '';
                const sound: Sound = findOrCreateItem(soundName, proj.sounds, Sound);
                handleFile(file, filename, sound);
            }
            else if (Backdrop.REG_EXP.test(path)) {
                handleFile(file, filename, proj.backdrop);
            }
            else {
                proj.defaultDir[path] = ArrayBuffer2Content(file.content, file.type, filename)
            }
        }
        return proj
    }

    /**
     * Load project from local storage using directory path.
     * @param {dirPath} dir
     */
    function loadProject(dir: dirPath) {
        const proj = parseProject(dir);
        backdropStore.setItem(proj.backdrop);
        spriteStore.setItem(proj.sprites);
        soundStore.setItem(proj.sounds);
        setTitle(proj.title);
        setDefaultDir(proj.defaultDir);
    }

    /**
     * Get project from local storage.
     * @param {string} name the name of project
     * @returns {dirPath} the directory of project
     * 
     * @example
     * const dir = await getProjectFromLocal('test')
     * loadProject(dir)
     */
    async function getDirPathFromLocal(name: string): Promise<dirPath | null> {
        const keys = await localForage.keys()
        const projectKeys = keys.filter(key => key.startsWith(name))
        if (projectKeys.length === 0) {
            return null
        }
        const project: dirPath = {}
        for (const key of projectKeys) {
            const value: FileType = await localForage.getItem(key) as FileType || null
            project[key] = value
        }
        return project
    }

    /**
     * Get all local project from IndexedDB (localForage).
     * @returns {Promise<string[]>}
     */
    async function getAllLocalProjects(): Promise<string[]> {
        const keys = await localForage.keys()
        const map = new Map()
        for (const key of keys) {
            const k = key.split('/').shift()
            if (!k) continue
            if (!map.has(k)) {
                map.set(k, true)
            }
        }
        return Array.from(map.keys())
    }

    /**
     * Save project to computer.
     */
    async function saveProjectToComputer() {
        const zip = new JSZip();
        const dir = convertProjectToDirectory()

        const zipFileValue = (key: string, value: string | File | Record<string, any>): [string, string | File] => {
            if (typeof value === 'string' || value instanceof File) {
                return [key, value]
            } else {
                return [key, JSON.stringify(value)]
            }
        }

        for (const [key, value] of Object.entries(dir)) {
            zip.file(...zipFileValue(key, value));
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `${project.value.title}.zip`);
    }

    return {
        setTitle,
        watchProjectChange,
        resetProject,
        saveProject,
        removeProject,
        loadProject,
        getDirPathFromZip,
        getDirPathFromLocal,
        saveProjectToComputer,
        title: readonly(title),
        getAllLocalProjects,
        project,
        addItem,
        removeItem,
        setItem
    }

})
