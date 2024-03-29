import * as vscode from 'vscode';
import * as vscel from '@wraith13/vscel';
import packageJson from "../package.json";
import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";
const locale = vscel.locale.make(localeEn, { "ja": localeJa });
const configRoot = vscel.config.makeRoot(packageJson);
export const preview = configRoot.makeEntry<boolean>("blitz.preview", "active-workspace");
export const disabledPreviewSettings = configRoot.makeEntry<string[]>("blitz.disabledPreviewSettings", "active-workspace");
export const debug = configRoot.makeEntry<boolean>("blitz.debug", "active-workspace");
const jsonCopy = <objectT>(object: objectT) => <objectT>JSON.parse(JSON.stringify(object));
type PrimaryConfigurationType = "null" | "boolean" | "string" | "integer" | "number" | "array" | "object";
type ConfigurationType = PrimaryConfigurationType | PrimaryConfigurationType[];
interface InspectResultType<valueT>
{
    key: string,
    defaultValue?: valueT,
    globalValue?: valueT,
    workspaceValue?: valueT,
    workspaceFolderValue?: valueT,
    defaultLanguageValue?: valueT,
    globalLanguageValue?: valueT,
    workspaceLanguageValue?: valueT,
    workspaceFolderLanguageValue?: valueT,
    languageIds?: string[],
};
// copy from https://github.com/microsoft/vscode/blob/b67444e6bb97998eeb160e08f9778a05b5054ff6/src/vs/platform/configuration/common/configurationRegistry.ts#L85-L110
export const enum ConfigurationScope
{
    // Application specific configuration, which can be configured only in local user settings.
    APPLICATION = 1,
    // Machine specific configuration, which can be configured only in local and remote user settings.
    MACHINE,
    // Window specific configuration, which can be configured in the user or workspace settings.
    WINDOW,
    // Resource specific configuration, which can be configured in the user, workspace or folder settings.
    RESOURCE,
    // Resource specific configuration that can be configured in language specific settings
    LANGUAGE_OVERRIDABLE,
    // Machine specific configuration that can also be configured in workspace or folder settings.
    MACHINE_OVERRIDABLE,
};
interface PackageJsonConfigurationBase
{
    "$ref"?: string;
    properties: { [key: string]: PackageJsonConfigurationProperty };
}
interface PackageJsonConfigurationProperty extends PackageJsonConfigurationBase
{
    type: ConfigurationType;
    scope?: ConfigurationScope;
    default?: any;
    items?: PackageJsonConfigurationProperty;
    enum?: string[];
    pattern?: string;
    errorMessage?: string;
    minimum?: number;
    maximum?: number;
    overridable?: boolean;
    description?: string;
    enumDescriptions?: string[];
    markdownDescription?: string;
    markdownEnumDescriptions?: string[];
    deprecationMessage?: string;
    markdownDeprecationMessage?: string;
    tags?: string[];
    allOf?: PackageJsonConfigurationProperty[];
    uniqueItems?: boolean;
}
interface PackageJsonConfiguration extends PackageJsonConfigurationBase
{
    id?: string;
    order?: number;
    type?: ConfigurationType;
    title: string;
}
interface PackageJsonLanguage
{
    id: string;
    extensions?: string[];
    aliases?: string[];
};
interface PackageJsonContributes
{
    configuration?: PackageJsonConfiguration;
    configurationDefaults: object;
    languages?: PackageJsonLanguage[]
}
interface PackageJson
{
    name: string;
    displayName: string;
    description: string;
    version: string;
    contributes: PackageJsonContributes;
};
interface SettingsEntry extends PackageJsonConfigurationProperty
{
    id: string;
};
const makeSettingsEntry = (id: string, property: PackageJsonConfigurationProperty): SettingsEntry =>
    Object.assign({ id, }, property);
const isDeprecatedEntry = (entry: SettingsEntry): boolean =>
    undefined !== entry.deprecationMessage ||
    undefined !== entry.markdownDeprecationMessage;
interface SchemasSettingsDefault
{
    properties: { [key: string]: PackageJsonConfigurationProperty };
    patternProperties: unknown;
    additionalProperties: boolean;
    allowTrailingCommas: boolean;
    allowComments: boolean;
};
class CommandContext
{
    public schemas: { [uri: string]: object } = { };
}
interface SettingsContext
{
    configurationTarget: vscode.ConfigurationTarget;
    overrideInLanguage: boolean;
}
interface SettingsFocus extends SettingsContext
{
    context: CommandContext;
    entry: SettingsEntry;
}
const makeFocusDetail = (focus: SettingsFocus, detailEntry: SettingsEntry): SettingsFocus =>
({
    configurationTarget: focus.configurationTarget,
    overrideInLanguage: focus.overrideInLanguage,
    context: focus.context,
    entry: detailEntry,
});
interface SettingsPointer extends SettingsContext
{
    id: string;
    detailId: string[];
    scope: vscode.ConfigurationScope | null | undefined;
}
const makePointer = (focus: SettingsFocus): SettingsPointer =>
({
    configurationTarget: focus.configurationTarget,
    overrideInLanguage: focus.overrideInLanguage,
    id: focus.entry.id,
    detailId: [],
    scope: makeConfigurationScope(focus),
});
const PointerToKeyString = (pointer: SettingsPointer) => pointer.id + pointer.detailId.map(i => `[${JSON.stringify(i)}]`).join("");
const makePointerDetail = (pointer: SettingsPointer, detailId: string): SettingsPointer =>
({
    configurationTarget: pointer.configurationTarget,
    overrideInLanguage: pointer.overrideInLanguage,
    id: pointer.id,
    detailId: pointer.detailId.concat(detailId),
    scope: pointer.scope,
});
const isPreviewEnabled = (pointer: SettingsPointer) =>
{
    const key = PointerToKeyString(pointer) + "[";
    return preview.get("default-scope") && disabledPreviewSettings.get("default-scope").filter(i => key.startsWith(i +"[")).length <= 0;
};
const setDetailValue = (root: any, detailId: string[], value: unknown) =>
{
    if (0 < detailId.length)
    {
        if (undefined !== value)
        {
            const sureRoot = root ?? { };
            if (1 < detailId.length)
            {
                sureRoot[detailId[0]] = setDetailValue
                (
                    sureRoot[detailId[0]] ?? { },
                    detailId.filter((_i, ix) => 0 < ix),
                    value
                );
            }
            else
            {
                sureRoot[detailId[0]] = value;
            }
            return sureRoot;
        }
        else
        {
            if (undefined !== root)
            {
                if (undefined !== root[detailId[0]])
                {
                    if (1 < detailId.length)
                    {
                        setDetailValue
                        (
                            root[detailId[0]],
                            detailId.filter((_i, ix) => 0 < ix),
                            value
                        );
                        if (Object.keys(root[detailId[0]]).length <= 0)
                        {
                            delete root[detailId[0]];
                        }
                    }
                    else
                    {
                        delete root[detailId[0]];
                    }
                }
                if (0 < Object.keys(root).length)
                {
                    return root;
                }
            }
            return undefined;
        }
    }
    else
    {
        return value;
    }
};
const getDetailValue = (root: any, detailId: string[]) => detailId.reduce((x, i) => x?.[i], root);
const getSchema = async (context: CommandContext, uri: string, self?: any) =>
    undefined !== uri && 0 < uri.length ?
    (
        context.schemas[uri] ??
        (
            context.schemas[uri] = JSON.parse
            (
                (
                    await vscode.workspace.openTextDocument
                    (
                        vscode.Uri.parse(uri)
                    )
                )
                .getText()
            )
        )
    ):
    self;
const getOjectWithPath = (current: any, path: string): any =>
{
    const parts = path.split("/").filter(i => 0 < i.length);
    if (0 < parts.length && 0 < parts[0].length)
    {
        return getOjectWithPath(current[parts[0]], path.substr(parts[0].length +1));
    }
    return current;
};
const loadReference = async <T extends object>(context: CommandContext, self: any, current: T, reference: string): Promise<T> =>
{
    const parts = reference.split("#" );
    const uri = parts[0];
    const path = parts[1] ?? "";
    console.log(`loadReference: ${JSON.stringify({ uri, path, })}`);
    const schema = await getSchema(context, uri, self);
    return Object.assign
    (
        current,
        getOjectWithPath(schema, path)
    );
};
const resolveReference = async <T extends { "$ref"?: string }>(context: CommandContext, self: any, current: T = self): Promise<T> =>
{
    if (current && "object" === typeof current && "string" === typeof current.$ref)
    {
        await loadReference(context, self, current, current.$ref);
        delete current.$ref;
    }
    return current;
};
/*
const recursiveResolveReference = async <T extends { "$ref"?: string }>(context: CommandContext, self: any, current: T = self): Promise<T> =>
{
    if (current && "object" === typeof current)
    {
        if (Array.isArray(current))
        {
            await Promise.all(current.map(i => recursiveResolveReference(context, self, i)));
        }
        else
        {
            if ("string" === typeof current.$ref)
            {
                await loadReference(context, self, current, current.$ref);
                delete current.$ref;
            }
            else
            {
                await Promise.all
                (
                    Object
                        .keys(current)
                        .map(key => recursiveResolveReference(context, self, (<any>current)[key]))
                );
            }
        }
    }
    return current;
};
*/
const getVscodeSettings = async (context: CommandContext): Promise <SchemasSettingsDefault> =>
    <SchemasSettingsDefault>
    (
        (await getSchema(context, "vscode://schemas/settings/default")) ??
        (await getSchema(context, "vscode://schemas/settings/user"))
    );
export const getDefaultValue = (entry: SettingsEntry, pointer: SettingsPointer) =>
{
    const defaultValueFromInspectResult = getDefaultValueFromInspectResult(inspectConfiguration(pointer));
    if (undefined !== defaultValueFromInspectResult)
    {
        return defaultValueFromInspectResult;
    }
    if (undefined !== entry.default)
    {
        return entry.default;
    }
    switch
    (
        Array.isArray(entry.type) ?
            (<PrimaryConfigurationType[]> entry.type)[0]:
            <PrimaryConfigurationType>entry.type
    )
    {
    case "boolean":
        return false;
    case "string":
        return "";
    case "integer":
    case "number":
        return 0;
    case "array":
        return [ ];
    case "object":
        return { };
    default:
        return null;
    }
};
export const getType = (value: any): PrimaryConfigurationType =>
    "object" === typeof value && Array.isArray(value) ?
        "array":
        <PrimaryConfigurationType> typeof value; // JSON のデータが前提なので。
export const markdownToPlaintext = (markdown: string | undefined) =>
    undefined === markdown ?
        undefined:
        markdown.replace(/`#([a-zA-Z_0-9\-\.]+)#`/mg, "`$1`");
export const extensionSettings = (): SettingsEntry[] => vscode.extensions.all
    .map(i => <PackageJsonConfiguration>(<PackageJson>i?.packageJSON)?.contributes?.configuration)
    .filter(i => i?.properties)
    .map
    (
        i => Object.keys(i.properties).map
        (
            id => Object.assign
            (
                {
                    title: i.title,
                    id,
                },
                i.properties[id]
            )
        )
    )
    .reduce((a, b) => a.concat(b), [ ]);
const idRegExp = /^(.*)(\.)([^.]*)$/;
export const makeConfigurationSection = (id: string) =>
{
    let result: string | undefined = id.replace(idRegExp, "$1");
    if (id === result)
    {
        result = undefined;
    }
    return result;
};
export const makeConfigurationKey = (id: string) => id.replace(idRegExp, "$3");
export const aggregateSettings = async (context: CommandContext) =>
    Object.entries
    (
        (await getVscodeSettings(context)).properties
    )
    .map
    (
        ([id, entry]) => Object.assign
        (
            {
                id,
            },
            entry
        )
    );
export const inspectConfiguration = <T>(pointer: SettingsPointer) => vscode.workspace.getConfiguration
(
    makeConfigurationSection(pointer.id),
    pointer.scope
)
.inspect<T>
(
    makeConfigurationKey(pointer.id)
);
export const getValueFromInspectResult =
<valueT>(
    context:
    {
        configurationTarget: vscode.ConfigurationTarget,
        overrideInLanguage: boolean,
    },
    inspect: InspectResultType<valueT> | undefined
) =>
{
    if ( ! context.overrideInLanguage)
    {
        switch(context.configurationTarget)
        {
        case vscode.ConfigurationTarget.Global:
            return inspect?.globalValue;
        case vscode.ConfigurationTarget.Workspace:
            return inspect?.workspaceValue;
        case vscode.ConfigurationTarget.WorkspaceFolder:
            return inspect?.workspaceFolderValue;
        }
    }
    else
    {
        switch(context.configurationTarget)
        {
        case vscode.ConfigurationTarget.Global:
            return inspect?.globalLanguageValue;
        case vscode.ConfigurationTarget.Workspace:
            return inspect?.workspaceLanguageValue;
        case vscode.ConfigurationTarget.WorkspaceFolder:
            return inspect?.workspaceFolderLanguageValue;
        }
    }
    return undefined;
};
export const hasValueInInspectResult = (inspect: InspectResultType<unknown> | undefined) =>
    undefined !== inspect?.globalValue ||
    undefined !== inspect?.workspaceValue ||
    undefined !== inspect?.workspaceFolderValue ||
    undefined !== inspect?.globalLanguageValue ||
    undefined !== inspect?.workspaceLanguageValue ||
    undefined !== inspect?.workspaceFolderLanguageValue;
export const getProjectionValueFromInspectResult = <valueT>(inspect: InspectResultType<valueT> | undefined) =>
    inspect?.workspaceFolderLanguageValue ??
    inspect?.workspaceLanguageValue ??
    inspect?.globalLanguageValue ??
    inspect?.defaultLanguageValue ??
    inspect?.workspaceFolderValue ??
    inspect?.workspaceValue ??
    inspect?.globalValue ??
    inspect?.defaultValue;
export const getDefaultValueFromInspectResult = <valueT>(inspect: InspectResultType<valueT> | undefined) =>
    inspect?.defaultLanguageValue ??
    inspect?.defaultValue;
export const getConfigurationProjectionValue = <T>(pointer: SettingsPointer): T | undefined => vscode.workspace.getConfiguration
(
    makeConfigurationSection(pointer.id),
    pointer.scope
)
.get<T>
(
    makeConfigurationKey(pointer.id)
);
export const getConfigurationTargetValue = <T>(pointer: SettingsPointer): T | undefined => getValueFromInspectResult
(
    pointer,
    inspectConfiguration(pointer)
);
export const setConfigurationRaw =
async (
    pointer: SettingsPointer,
    value: unknown
) => await vscode.workspace.getConfiguration
(
    makeConfigurationSection(pointer.id),
    pointer.scope
)
.update
(
    makeConfigurationKey(pointer.id),
    0 < pointer.detailId.length ?
        setDetailValue(getConfigurationTargetValue(pointer), pointer.detailId, value):
        value,
    pointer.configurationTarget,
    pointer.overrideInLanguage
);
interface ConfigurationQueueEntry
{
    pointer: SettingsPointer,
    value: unknown,
    resolve: () => void,
    rejct: () => void,
    timer: NodeJS.Timeout,
};
const configurationQueue: ConfigurationQueueEntry[]  = [];
export const timeout = (wait: number) => new Promise((resolve) => setTimeout(resolve, wait));
const filterIndex = <T>(list: T[], where: (i: T) => boolean) => list
    .map((i, ix) => where(i) ? ix: -1)
    .filter(ix => 0 <= ix);
const spliceWhere = <T>(list: T[], where: (i: T) => boolean) => filterIndex(list, where)
    .reverse()
    .map(ix => list.splice(ix, 1)[0])
    .reverse();
export const setConfigurationQueue =
async (
    pointer: SettingsPointer,
    value: unknown,
    wait = 500
) => new Promise<void>
(
    async (resolve, rejct) =>
    {
        spliceWhere(configurationQueue, i => JSON.stringify(i.pointer) === JSON.stringify(pointer))
            .forEach
            (
                i =>
                {
                    clearTimeout(i.timer);
                    i.rejct();
                }
            );
        const timer: NodeJS.Timeout = <any>setTimeout // 本来、ここで any は要らないが、現状の webpack ベースのコンパイルではここでエラーになってしまう為。
        (
            async () => await Promise.all
            (
                spliceWhere(configurationQueue, i => timer === i.timer)
                    .map
                    (
                        async (i) =>
                        {
                            try
                            {
                                await setConfigurationRaw(i.pointer, i.value);
                            }
                            catch
                            {
                                i.rejct();
                            }
                            i.resolve();
                        }
                    )
            ),
            wait
        );
        configurationQueue.push
        ({
            pointer,
            value,
            resolve,
            rejct,
            timer,
        });
    }
);
interface UndoEntry
{
    pointer: SettingsPointer;
    newValue: unknown;
    oldValue: unknown;
};
const recentlyEntriesStrageId = `wraith13.blitz.recently.entries`;
const recentlyDetailsStrageId = `wraith13.blitz.recently.details`;
const recentlyValuesStrageId = `wraith13.blitz.recently.values`;
const recentlyArrayItemsStrageId = `wraith13.blitz.recently.arrayItems`;
const getRecentlyEntries = () => extensionContext.globalState.get<string[]>(recentlyEntriesStrageId) ?? [];
const makePointerStrageId = (pointer: SettingsPointer) => JSON.stringify([pointer.id].concat(pointer.detailId));
const getRecentlyDetailsRoot = () => extensionContext.globalState.get<{[pointer: string]:string[]}>(recentlyDetailsStrageId) ?? { };
const getRecentlyDetails = (pointer: SettingsPointer) => getRecentlyDetailsRoot()[makePointerStrageId(pointer)] ?? [];
const getRecentlyValuesRoot = () => extensionContext.globalState.get<{[pointer: string]:string[]}>(recentlyValuesStrageId) ?? { };
const getRecentlyValues = (pointer: SettingsPointer) => getRecentlyValuesRoot()[makePointerStrageId(pointer)] ?? [];
const getRecentlyArrayItemsRoot = () => extensionContext.globalState.get<{[pointer: string]:string[]}>(recentlyArrayItemsStrageId) ?? { };
const getRecentlyArrayItems = (pointer: SettingsPointer) => getRecentlyArrayItemsRoot()[makePointerStrageId(pointer)] ?? [];
const setRecentlyEntries = async (entry: UndoEntry) =>
{
    const recentlyEntries = getRecentlyEntries();
    const oldIndex = recentlyEntries.indexOf(entry.pointer.id);
    if (0 <= oldIndex)
    {
        recentlyEntries.splice(oldIndex, 1);
    }
    recentlyEntries.splice(0, 0, entry.pointer.id);
    recentlyEntries.splice(128);
    await extensionContext.globalState.update(recentlyEntriesStrageId, recentlyEntries);
};
const setRecentlyDetails = async (entry: UndoEntry) =>
{
    if (0 < entry.pointer.detailId.length)
    {
        const recentlyValues = getRecentlyDetailsRoot();
        const details = recentlyValues[makePointerStrageId(entry.pointer)] ?? [];
        const json = JSON.stringify(entry.pointer.detailId);
        spliceWhere(details, i => i === json);
        details.splice(0, 0, json);
        details.splice(32);
        recentlyValues[makePointerStrageId(entry.pointer)] = details;
        await extensionContext.globalState.update(recentlyDetailsStrageId, recentlyValues);
    }
};
const setRecentlyValues = async (entry: UndoEntry) =>
{
    const recentlyValues = getRecentlyValuesRoot();
    const values = recentlyValues[makePointerStrageId(entry.pointer)] ?? [];
    const add = (value: unknown) =>
    {
        if (undefined !== value)
        {
            const json = JSON.stringify(value);
            spliceWhere(values, i => i === json);
            values.splice(0, 0, json);
        }
    };
    add(entry.oldValue); // blitz 以外で設定されてた値を拾う為
    add(entry.newValue);
    values.splice(8); // enum の場合、表示側で削る。( 削らないと全部の選択肢が recently 表示というアホな事になる。 )
    recentlyValues[makePointerStrageId(entry.pointer)] = values;
    await extensionContext.globalState.update(recentlyValuesStrageId, recentlyValues);
};
const setRecentlyArrayItems = async (entry: UndoEntry) =>
{
    if (Array.isArray(entry.oldValue) || Array.isArray(entry.newValue))
    {
        const recentlyArrayItems = getRecentlyArrayItemsRoot();
        const items = recentlyArrayItems[makePointerStrageId(entry.pointer)] ?? [];
        const add = (value: string) =>
        {
            spliceWhere(items, i => i === value);
            items.splice(0, 0, value);
        };
        const oldArray = Array.isArray(entry.oldValue) ? entry.oldValue.map(i => JSON.stringify(i)): [];
        const newArray = Array.isArray(entry.newValue) ? entry.newValue.map(i => JSON.stringify(i)): [];
        oldArray.filter(i => ! newArray.includes(i)).forEach(add);
        newArray.filter(i => ! oldArray.includes(i)).forEach(add);
        items.splice(32); // 対象の配列がデカい場合、すぐに recently が埋まって流れてしまい兼ねないので、かなり多めに保存する。 enum の場合、表示側で削る。( 削らないと全部の選択肢が recently 表示というアホな事になる。 )
        recentlyArrayItems[makePointerStrageId(entry.pointer)] = items;
        await extensionContext.globalState.update(recentlyArrayItemsStrageId, recentlyArrayItems);
    }
};
const setRecentlies = async (entry: UndoEntry) =>
{
    await setRecentlyEntries(entry);
    await setRecentlyDetails(entry);
    await setRecentlyValues(entry);
    await setRecentlyArrayItems(entry);
};
export const clearRecentlies = async () =>
{
    await extensionContext.globalState.update(recentlyEntriesStrageId, undefined);
    await extensionContext.globalState.update(recentlyDetailsStrageId, undefined);
    await extensionContext.globalState.update(recentlyValuesStrageId, undefined);
    await extensionContext.globalState.update(recentlyArrayItemsStrageId, undefined);
};
const undoBuffer: UndoEntry[] = [];
const redoBuffer: UndoEntry[] = [];
const makeUndoEntry =
(
    pointer: SettingsPointer,
    newValue: unknown,
    oldValue: unknown = getDetailValue
    (
        getConfigurationTargetValue(pointer),
        pointer.detailId
    )
) => ({ pointer, oldValue, newValue, });
export const setConfiguration = async (entry: UndoEntry) =>
{
    if (JSON.stringify(entry.oldValue) !== JSON.stringify(entry.newValue))
    {
        redoBuffer.splice(0, redoBuffer.length);
        undoBuffer.push(entry);
        await onDidUpdateUndoBuffer();
        await setRecentlies(entry);
    }
    await setConfigurationQueue(entry.pointer, entry.newValue);
};
export const UndoConfiguration = async () =>
{
    const entry = undoBuffer.pop();
    if (undefined !== entry)
    {
        redoBuffer.push(entry);
        await setConfigurationQueue(entry.pointer, entry.oldValue);
        await onDidUpdateUndoBuffer();
    }
};
export const RedoConfiguration = async () =>
{
    const entry = redoBuffer.pop();
    if (undefined !== entry)
    {
        undoBuffer.push(entry);
        await setConfigurationQueue(entry.pointer, entry.newValue);
        await onDidUpdateUndoBuffer();
    }
};
export const setContext = async (key: string, value: any) =>
    await vscode.commands.executeCommand('setContext', key, value);
export const onDidUpdateUndoBuffer = async () =>
{
    await setContext('isBlitzUndoable', 0 < undoBuffer.length);
    await setContext('isBlitzRedoable', 0 < redoBuffer.length);
};
export const getProperties = (entry: SettingsEntry) =>
{
    const properties = Object.assign({ }, entry.properties ?? { });
    if (entry.allOf)
    {
        entry.allOf
            .filter(i => undefined !== i.properties)
            .forEach(i => Object.assign(properties, i));
    }
    return properties;
};
export const makeSettingValueItem =
(
    entry: UndoEntry,
    description?: string,
    detail?: string,
    when?: (menus: vscel.menu.CommandMenuItem[]) => boolean
) =>
({
    label: `$(tag) ${JSON.stringify(entry.newValue)}`,
    description,
    detail,
    when,
    preview: async () => await setConfigurationQueue(entry.pointer, entry.newValue),
    command: async () => await setConfiguration(entry),
});
export const makeSettingValueItemList = (focus: SettingsFocus, pointer: SettingsPointer, oldValue: any): vscel.menu.CommandMenuItem[] =>
{
    const entry = focus.entry;
    const list:
    {
        value: any,
        description: string[],
        detail?: string,
        when?: (menus: vscel.menu.CommandMenuItem[]) => boolean
    }[ ] = [ ];
    const register = (value: any, description?: string, detail?: string, when?: (menus: vscel.menu.CommandMenuItem[]) => boolean) =>
    {
        const item = list.filter(i => JSON.stringify(i.value) === JSON.stringify(value))[0];
        if (item)
        {
            if (undefined !== description)
            {
                item.description.push(description);
                if (2 <= item.description.length)
                {
                    item.description = item.description.filter(i => !i.startsWith("recently"));
                }
            }
            if (undefined !== detail)
            {
                item.detail = detail;
            }
            if (undefined !== when)
            {
                if (undefined !== item.when)
                {
                    const oldWhen = item.when;
                    item.when = menus => oldWhen(menus) && when(menus);
                }
                else
                {
                    item.when = when;
                }
            }
        }
        else
        {
            list.push
            ({
                value,
                description: undefined !== description ? [ description ]: [ ],
                detail,
                when
            });
        }
    };
    const types =
        undefined === entry.type ? [ ]:
        ("string" === typeof entry.type ? [ entry.type ]: entry.type);
    if (0 <= types.indexOf("null"))
    {
        register(null);
    }
    if (0 <= types.indexOf("boolean"))
    {
        register(true);
        register(false);
    }
    if (undefined !== entry.minimum)
    {
        register(entry.minimum, "minimum");
    }
    if (undefined !== entry.maximum)
    {
        register(entry.maximum, "maximum");
    }
    if (entry.enum)
    {
        entry.enum.forEach
        (
            (value, index) => register
            (
                value,
                undefined,
                entry?.enumDescriptions?.[index] ?? markdownToPlaintext(entry?.markdownEnumDescriptions?.[index])
            )
        );
    }
    const defaultValue = getDetailValue(getDefaultValue(entry, pointer), pointer.detailId);
    if (undefined !== defaultValue)
    {
        register(defaultValue, "default", undefined, menus => menus.filter(i => 0 <= (i.tags?.indexOf("typed object") ?? -1)).length <= 0);
    }
    if (undefined !== oldValue)
    {
        register(oldValue, "current", undefined, menus => menus.filter(i => 0 <= (i.tags?.indexOf("typed object") ?? -1)).length <= 0);
    }
    if (0 <= (<PrimaryConfigurationType[]>[ "string", "integer", "number", "array", "object" ]).filter(i => 0 <= types.indexOf(i)).length)
    {
        const hasArrayRecentlies = 0 < getRecentlyArrayItems(pointer).length;
        getRecentlyValues(pointer)
            .filter((_i, ix) => ! hasArrayRecentlies || ix < 3)
            .filter((_i, ix) => undefined === entry.enum || ix +1 <= entry.enum.length /3.0)
            .forEach(i => register(JSON.parse(i), `recently`));
    }
    const typeIndexOf = (value: any) =>
    {
        switch(typeof value)
        {
        case "boolean":
            return 1;
        case "string":
            return 2;
        case "number":
            return 3;
        case "object":
            return Array.isArray(value) ? 4: 5;
        default:
            return 0;
        }
    };
    list.sort
    (
        vscel.comparer.make
        ([
            { condition: () => 16 <= list.length, getter: a => 0 < a.description.length ? 0: 1, },
            a => typeIndexOf(a.value),
            { condition: () => 0 < (entry.enum?.length ?? 0), getter: a => entry.enum?.indexOf(a.value), },
            { condition: { getter: a => a.value, type: "number", }, getter: a => a.value, },
            { condition: { getter: a => a.value, type: "string", }, getter: a => a.value, },
            { condition: { getter: a => a.value, type: "object", }, getter: a => JSON.stringify(a.value), },
        ])
    );
    return list.map
    (
        i => makeSettingValueItem
        (
            makeUndoEntry(pointer, i.value, oldValue),
            0 < i.description.length ? i.description.join(", "): undefined,
            i.detail,
            i.when
        )
    );
};
export const hasType = (entry: PackageJsonConfigurationProperty, type: PrimaryConfigurationType): boolean =>
{
    if
    (
        undefined !== entry.type &&
        (
            Array.isArray(entry.type) ?
                0 <= (entry.type) .indexOf(type):
                entry.type === type
        )
    )
    {
        return true;
    }
    if (0 < (entry?.allOf?.filter(i => hasType(i, type))?.length ?? 0))
    {
        return true;
    }
    if (type === getType(entry.default))
    {
        return true;
    }
    return false;
};
export const editSettingValue =
async (
    pointer: SettingsPointer,
    oldValue: any,
    //validateInput: (input: string) => string | undefined | null | Thenable<string | undefined | null>,
    validateInput: (input: string) => string | undefined | null,
    parser: (input: string) => unknown,
    value: string// = toStringOrUndefined(oldValue)
) => await vscel.menu.showInputBox
({
    value,
    validateInput: async (input) =>
    {
        const result = validateInput(input);
        if ((undefined === result || null === result) && isPreviewEnabled(pointer))
        {
            await setConfigurationQueue(pointer, parser(input));
        }
        return result;
    },
    preview: false,
    command: async input => await setConfiguration({ pointer, newValue: parser(input), oldValue, }),
    onCancel: makeRollBackMethod(pointer, oldValue)
});
export const toStringOfDefault = (value: any, defaultValue: any) =>
    undefined === value ?
        defaultValue:
        (
            "string" === typeof value ?
                value:
                JSON.stringify(value)
        );
export const toStringOrUndefined = (value: any) => toStringOfDefault(value, undefined);
export const toStringForce = (value: any) => toStringOfDefault(value, "undefined");
export const makeEditSettingValueItemList = async (focus: SettingsFocus, pointer: SettingsPointer, oldValue: any): Promise<vscel.menu.CommandMenuItem[]> =>
{
    const entry = focus.entry;
    const result: vscel.menu.CommandMenuItem[] = [ ];
    const value = toStringOrUndefined(oldValue ?? getDetailValue(getDefaultValue(entry, pointer), pointer.detailId));
    if (undefined === entry.enum && hasType(entry, "string"))
    {
        result.push
        ({
            label: `$(edit) ${locale.typeableMap("Input string")}`,
            command: async () => await editSettingValue
            (
                pointer,
                oldValue,
                input =>
                {
                    if (undefined !== entry.pattern)
                    {
                        if ( ! new RegExp(entry.pattern, "u").test(input))
                        {
                            return entry.errorMessage ?? `${locale.map("This value must match that regular expression.")}:${entry.pattern}`;
                        }
                    }
                    return undefined;
                },
                input => input,
                value
            )
        });
    }
    if (hasType(entry, "integer"))
    {
        result.push
        ({
            label: `$(edit) ${locale.typeableMap("Input integer")}`,
            command: async () => await editSettingValue
            (
                pointer,
                oldValue,
                input =>
                {
                    const value = parseInt(input);
                    if (isNaN(value) || value !== parseFloat(input))
                    {
                        return locale.map("Invalid integer.");
                    }
                    if (undefined !== entry.minimum && value < entry.minimum)
                    {
                        return `${locale.map("Minimum")}: ${entry.minimum}`;
                    }
                    if (undefined !== entry.maximum && entry.maximum < value)
                    {
                        return `${locale.map("Maximum")}: ${entry.maximum}`;
                    }
                    return undefined;
                },
                input => parseInt(input),
                value
            )
        });
    }
    if (hasType(entry, "number"))
    {
        result.push
        ({
            label: `$(edit) ${locale.typeableMap("Input number")}`,
            command: async () => await editSettingValue
            (
                pointer,
                oldValue,
                input =>
                {
                    const value = parseFloat(input);
                    if (isNaN(value))
                    {
                        return locale.map("Invalid number.");
                    }
                    if (undefined !== entry.minimum && value < entry.minimum)
                    {
                        return `${locale.map("Minimum")}: ${entry.minimum}`;
                    }
                    if (undefined !== entry.maximum && entry.maximum < value)
                    {
                        return `${locale.map("Maximum")}: ${entry.maximum}`;
                    }
                    return undefined;
                },
                input => parseFloat(input),
                value
            )
        });
    }
    if (hasType(entry, "array"))
    {
        result.push
        ({
            label: `$(edit) ${locale.typeableMap("Input array")}`,
            command: async () => await editSettingValue
            (
                pointer,
                oldValue,
                input =>
                {
                    try
                    {
                        const value = JSON.parse(input);
                        if ("object" !== typeof value)
                        {
                            return locale.map("Invalid array.");
                        }
                        if ( ! Array.isArray(value))
                        {
                            return locale.map("Invalid array.");
                        }
                    }
                    catch
                    {
                        return locale.map("Invalid array.");
                    }
                    return undefined;
                },
                input => JSON.parse(input),
                value
            )
        });
    }
    if (hasType(entry, "object"))
    {
        result.push
        ({
            label: `$(edit) ${locale.typeableMap("Input object")}`,
            command: async () => await editSettingValue
            (
                pointer,
                oldValue,
                input =>
                {
                    try
                    {
                        const value = JSON.parse(input);
                        if ("object" !== typeof value)
                        {
                            return locale.map("Invalid object.");
                        }
                        if (Array.isArray(value))
                        {
                            return locale.map("Invalid object.");
                        }
                    }
                    catch
                    {
                        return locale.map("Invalid object.");
                    }
                    return undefined;
                },
                input => JSON.parse(input),
                value
            )
        });
        /*
        const properties = getProperties(entry);
        Object.keys(properties)
            .forEach
            (
                key =>
                {
                    properties[key]
                }
            );
        */
    }
    return result;
};
export const makeSettingValueEditArrayItemList = (focus: SettingsFocus, pointer: SettingsPointer, oldValue: any): vscel.menu.CommandMenuItem[] =>
{
    const entry = focus.entry;
    const result: vscel.menu.CommandMenuItem[] = [ ];
    if (hasType(entry, "array"))
    {
        let value = getConfigurationTargetValue<any[]>(pointer);
        if (undefined === value)
        {
            value = getDefaultValueFromInspectResult(inspectConfiguration(pointer));
            if (! Array.isArray(value))
            {
                value = [ ];
            }
        }
        if (Array.isArray(value))
        {
            const array = value;
            const recentlies = getRecentlyArrayItems(pointer)
                .filter((_i, ix) => undefined === entry.items?.enum || ix +1 <= entry.items?.enum.length /3.0);
            if (entry.items?.type && hasType(entry.items, "null"))
            {
                const newValue = array.concat([ null ]);
                result.push
                ({
                    label: `$(add) ${locale.map("Add null item")}`,
                    preview: async () => await setConfigurationQueue(pointer, newValue),
                    command: async () => await setConfiguration({ pointer, newValue, oldValue, }),
                });
            }
            if ( ! entry.items?.type || hasType(entry.items, "string"))
            {
                if (undefined === entry.items?.enum)
                {
                    result.push
                    ({
                        label: `$(add) ${locale.map("Add string item")}`,
                        command: async () => await editSettingValue
                        (
                            pointer,
                            oldValue,
                            input =>
                            {
                                if (undefined !== entry.items?.pattern)
                                {
                                    if ( ! new RegExp(entry.items?.pattern, "u").test(input))
                                    {
                                        return entry.items?.errorMessage ?? `${locale.map("This value must match that regular expression.")}:${entry.items?.pattern}`;
                                    }
                                }
                                return undefined;
                            },
                            input => array.concat([ input ]),
                            "",
                        )
                    });
                }
            }
            array.forEach
            (
                (item, index) =>
                {
                    const newValue = array.filter((_,ix) => ix !== index);
                    result.push
                    ({
                        label: `$(remove) ${locale.map("Remove")}: ${JSON.stringify(item)}`,
                        description: recentlies.includes(JSON.stringify(item)) ? "recently": undefined,
                        preview: async () => await setConfigurationQueue(pointer, newValue),
                        command: async () => await setConfiguration({ pointer, newValue, oldValue, }),
                    });
                }
            );
            const arrayJson = array.map(i => JSON.stringify(i));
            recentlies.filter(item => ! ((entry.uniqueItems ?? false) && arrayJson.includes(item)))
            .forEach
            (
                item => result.push
                ({
                    label: `$(add) ${locale.map("Add")}: ${item}`,
                    description: arrayJson.includes(item) ? "current": "recently",
                    preview: async () => await setConfigurationQueue(pointer, array.concat([ JSON.parse(item) ])),
                    command: async () => await setConfiguration({ pointer, newValue:array.concat([ JSON.parse(item) ]), oldValue, }),
                })
            );
            if ( ! entry.items?.type || hasType(entry.items, "string"))
            {
                if (undefined !== entry.items?.enum)
                {
                    entry.items.enum
                        .filter(item => ! ((entry.uniqueItems ?? false) && array.includes(item)))
                        .filter(item => ! recentlies.includes(JSON.stringify(item)))
                        .forEach
                        (
                            item => result.push
                            ({
                                label: `$(add) ${locale.map("Add")}: "${item}"`,
                                description: array.includes(item) ? "current": undefined,
                                preview: async () => await setConfigurationQueue(pointer, array.concat([ item ])),
                                command: async () => await setConfiguration({ pointer, newValue:array.concat([ item ]), oldValue, }),
                            })
                        );
                }
            }
        }
    }
    return result;
};
export const makeSettingValueEditObjectItemList = async (focus: SettingsFocus, pointer: SettingsPointer, oldValue: any): Promise<vscel.menu.CommandMenuItem[]> =>
{
    const entry = focus.entry;
    const result: vscel.menu.CommandMenuItem[] = [ ];
    const object = getConfigurationProjectionValue<any>(pointer);
    if ( ! Array.isArray(object))
    {
        const properties = jsonCopy(entry.properties ?? { });
        if (entry.allOf)
        {
            await Promise.all
            (
                entry.allOf.map
                (
                    async (i) =>
                    {
                        await resolveReference(focus.context, i);
                        if (i.properties)
                        {
                            Object.assign
                            (
                                properties,
                                await resolveReference(focus.context, i.properties)
                            );
                        }
                    }
                )
            );
        }
        const recentlies = getRecentlyDetails(pointer);
        recentlies
            .filter(i => undefined !== properties[i])
            .concat(Object.keys(properties).filter(i => recentlies.indexOf(i) < 0))
            .sort
            (
                vscel.comparer.make
                ([
                    a => undefined === oldValue?.[a] ? 1: 0,
                    a => a.startsWith("[") ? 0: 1,
                    { raw: vscel.comparer.basic, }
                ])
            )
            .forEach
            (
                i => result.push
                ({
                    label: `$(edit) ${i}`,
                    description: makeEditSettingDescriptionDetail(focus.entry, pointer.detailId.concat(i), oldValue?.[i]),
                    detail: properties[i].description ?? markdownToPlaintext(properties[i].markdownDescription),
                    command: async () => await editSettingItem
                    (
                        makeFocusDetail(focus, makeSettingsEntry(i, await resolveReference(focus.context, properties[i]))),
                        makePointerDetail(pointer, i),
                        oldValue?.[i],
                    ),
                    tags: ["typed object"]
                })
            );
    }
    return result;
};
export const makeEditSettingDescriptionDetail = (_entry: SettingsEntry, _detailId: string[], value: any) =>
    (
        undefined === value ?
            "":
            "* "
    )
    //+ [entry.id].concat(detailId).join(".") ここでは冗長なだけなので削る
    //+ ": "
    //+ makeDisplayType(getDetailValue(entry, detailId)) 型を取得できない事はないけど、メニューの表示が数秒単位で遅くなるので流石に都合が悪い・・・
    + " = "
    + JSON.stringify(value);
export const makeFullDescription = (entry: SettingsEntry) =>
{
    let description = entry.description ?? markdownToPlaintext(entry.markdownDescription) ?? locale.map("(This setting item has no description.)");
    const enumDescriptions = (entry.enumDescriptions ?? entry.markdownEnumDescriptions?.map(markdownToPlaintext));
    if (entry.enum && 0 < entry.enum.length && enumDescriptions && 0 < enumDescriptions.length)
    {
        description = [ description, "", ].concat(entry.enum.map((v, i) => `${v}: ${enumDescriptions[i]}`)).join("\n");
    }
    return description;
};
const makeShowDescriptionMenu =
(
    focus:
    {
        context: CommandContext;
        configurationTarget?: vscode.ConfigurationTarget;
        overrideInLanguage?: boolean;
        entry: SettingsEntry;
    },
    pointer?: SettingsPointer
): vscel.menu.CommandMenuItem =>
({
    label: `$(comment) ${locale.map("Show Full Description")}`,
    description: undefined === pointer ? focus.entry.id: makeSettingIdLabel(pointer),
    command: async () =>
    {
        const editThisSettingItem = locale.map("Edit this setting item...");
        const editOtherSetingItem = locale.map("Edit other setting item...");
        //const cancel = "Cancel"; //"キャンセル";
        switch
        (
            await vscode.window.showInformationMessage
            (
                makeFullDescription(focus.entry),
                { modal: true, },
                editThisSettingItem,
                editOtherSetingItem
                //cancel
            )
        )
        {
        case editThisSettingItem:
            undefined !== focus.configurationTarget && undefined !== focus.overrideInLanguage ?
                await editSettingItem(<SettingsFocus>focus, pointer):
                await selectContext(focus.context, focus.entry);
            break;
        case editOtherSetingItem:
            await editSettings(focus.context);
            break;
        }
    },
});
export const makeFullDeprecationMessage = (entry: SettingsEntry) =>
    entry.deprecationMessage ?? markdownToPlaintext(entry.markdownDeprecationMessage) ?? locale.map("(This setting item is NOT deprecated.)");
const makeShowDeprecationMessageMenu =
(
    focus:
    {
        context: CommandContext;
        configurationTarget?: vscode.ConfigurationTarget;
        overrideInLanguage?: boolean;
        entry: SettingsEntry;
    },
    pointer?: SettingsPointer
): vscel.menu.CommandMenuItem =>
({
    label: `$(warning) ${locale.map("Show Full Deprecation Message")}`,
    description: undefined === pointer ? focus.entry.id: makeSettingIdLabel(pointer),
    when: () => isDeprecatedEntry(focus.entry),
    command: async () =>
    {
        const editThisSettingItem = locale.map("Edit this setting item...");
        const editOtherSetingItem = locale.map("Edit other setting item...");
        //const cancel = "Cancel"; //"キャンセル";
        switch
        (
            await vscode.window.showInformationMessage
            (
                makeFullDeprecationMessage(focus.entry),
                { modal: true, },
                editThisSettingItem,
                editOtherSetingItem
                //cancel
            )
        )
        {
        case editThisSettingItem:
            undefined !== focus.configurationTarget && undefined !== focus.overrideInLanguage ?
                await editSettingItem(<SettingsFocus>focus, pointer):
                await selectContext(focus.context, focus.entry);
            break;
        case editOtherSetingItem:
            await editSettings(focus.context);
            break;
        }
    },
});
export const getLanguageName = (languageId: string) => vscode.extensions.all
    .map(i => <PackageJsonLanguage[]>(i.packageJSON as PackageJson)?.contributes?.languages)
    .filter(i => i)
    .reduce((a, b) => a.concat(b), [])
    .filter(i => i.id === languageId && 0 < (i.aliases?.length ?? 0))
    .map(i => i?.aliases?.[0])?.[0] ?? languageId;
export const makeContextLabel = (pointer: SettingsPointer) =>
{
    const languageId = (<{ uri: vscode.Uri | undefined, languageId: string, }>(<SettingsPointer>pointer).scope)?.languageId;
    if (languageId)
    {
        const languageName = getLanguageName(languageId);
        const languageLabel = languageName === languageId ? languageId: `${languageName} ( ${languageId} )`;
        switch(pointer.configurationTarget)
        {
        case vscode.ConfigurationTarget.Global:
            return `${locale.typeableMap("Global")} [ ${locale.typeableMap("language")}: ${languageLabel} ]`;
        case vscode.ConfigurationTarget.Workspace:
            return `${locale.typeableMap("Workspace")} [ ${locale.typeableMap("language")}: ${languageLabel} ]`;
        case vscode.ConfigurationTarget.WorkspaceFolder:
            return `${locale.typeableMap("WorkspaceFolder")} [ ${locale.typeableMap("language")}: ${languageLabel} ]`;
        default:
            return `${locale.typeableMap("UNKNOWN")} [ ${locale.typeableMap("language")}: ${languageLabel} ]`;
        }
    }
    else
    {
        switch(pointer.configurationTarget)
        {
        case vscode.ConfigurationTarget.Global:
            return locale.typeableMap("Global");
        case vscode.ConfigurationTarget.Workspace:
            return locale.typeableMap("Workspace");
        case vscode.ConfigurationTarget.WorkspaceFolder:
            return locale.typeableMap("WorkspaceFolder");
        default:
            return locale.typeableMap("UNKNOWN");
        }
    }
};
export const makeContextMenuItem = (focus: SettingsFocus, value: string, description: string | undefined): vscel.menu.CommandMenuItem =>
({
    label: `$(symbol-namespace) ${makeContextLabel(makePointer(focus))}: ${value}`,
    description,
    detail: (makeConfigurationScopeUri(focus.configurationTarget))?.fsPath,
    command: async () => await editSettingItem(focus),
});
const languageOverrideRegExp = /^\[(.*)\]$/;
export const isLanguageOverrideEntry = (entry: SettingsEntry) => languageOverrideRegExp.test(entry.id);
export const selectContext = async (context: CommandContext, entry: SettingsEntry) =>
{
    console.log(`selectContext.entry: ${ JSON.stringify(entry)}`);
    const contextMenuItemList: vscel.menu.CommandMenuItem[] = [ ];
    const languageId = getLanguageId();
    const values = inspectConfiguration
    (
        makePointer
        ({
            context,
            configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
            overrideInLanguage: true,
            entry
        })
    );
    const workspaceUri = makeConfigurationScopeUri(vscode.ConfigurationTarget.Workspace);
    const workspaceOverridable = undefined !== workspaceUri &&
        (
            undefined === entry.scope ||
            (
                ConfigurationScope.APPLICATION !== entry.scope &&
                ConfigurationScope.MACHINE !== entry.scope
            )
        );
    const workspaceFolderUri = makeConfigurationScopeUri(vscode.ConfigurationTarget.WorkspaceFolder);
    const workspaceFolderOverridable = undefined !== workspaceFolderUri &&
        workspaceUri !== workspaceFolderUri &&
        (
            undefined === entry.scope ||
            (
                ConfigurationScope.APPLICATION !== entry.scope &&
                ConfigurationScope.MACHINE !== entry.scope &&
                ConfigurationScope.WINDOW !== entry.scope
            )
        );
    const languageOverridable =
        ! isLanguageOverrideEntry(entry) &&
        languageId &&
        (
            entry.overridable ||
            undefined === entry.scope ||
            ConfigurationScope.LANGUAGE_OVERRIDABLE === entry.scope
        );
    const makeDescription = (defaultValue: any, value: any) =>
        (undefined !== value && value === defaultValue) ?
            "default":
            undefined;
    if (workspaceOverridable || workspaceFolderOverridable || languageOverridable)
    {
        contextMenuItemList.push
        (
            makeContextMenuItem
            (
                {
                    context,
                    configurationTarget: vscode.ConfigurationTarget.Global,
                    overrideInLanguage: false,
                    entry
                },
                toStringForce((undefined !== values?.globalValue)? values?.globalValue: values?.defaultValue),
                makeDescription(values?.defaultValue, values?.globalValue ?? values?.defaultValue)
            )
        );
        if (workspaceOverridable)
        {
            contextMenuItemList.push
            (
                makeContextMenuItem
                (
                    {
                        context,
                        configurationTarget: vscode.ConfigurationTarget.Workspace,
                        overrideInLanguage: false,
                        entry
                    },
                    toStringForce(values?.workspaceValue),
                    makeDescription(values?.defaultValue, values?.workspaceValue)
                )
            );
        }
        if (workspaceFolderOverridable)
        {
            contextMenuItemList.push
            (
                makeContextMenuItem
                (
                    {
                        context,
                        configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
                        overrideInLanguage: false,
                        entry
                    },
                    toStringForce(values?.workspaceFolderValue),
                    makeDescription(values?.defaultValue, values?.workspaceFolderValue)
                )
            );
        }
        if (languageOverridable)
        {
            contextMenuItemList.push
            (
                makeContextMenuItem
                (
                    {
                        context,
                        configurationTarget: vscode.ConfigurationTarget.Global,
                        overrideInLanguage: true,
                        entry
                    },
                    toStringForce
                    (
                        (undefined !== values?.globalLanguageValue) ?
                            values?.globalLanguageValue:
                            values?.defaultLanguageValue
                    ),
                    makeDescription(values?.defaultLanguageValue, values?.globalLanguageValue)
                )
            );
            if (workspaceOverridable)
            {
                contextMenuItemList.push
                (
                    makeContextMenuItem
                    (
                        {
                            context,
                            configurationTarget: vscode.ConfigurationTarget.Workspace,
                            overrideInLanguage: true,
                            entry
                        },
                        toStringForce(values?.workspaceLanguageValue),
                        makeDescription(values?.defaultLanguageValue, values?.workspaceLanguageValue)
                    )
                );
            }
            if (workspaceFolderOverridable)
            {
                contextMenuItemList.push
                (
                    makeContextMenuItem
                    (
                        {
                            context,
                            configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
                            overrideInLanguage: true,
                            entry
                        },
                        toStringForce(values?.workspaceFolderLanguageValue),
                        makeDescription(values?.defaultLanguageValue, values?.workspaceFolderLanguageValue)
                    )
                );
            }
        }
    }
    if (0 < contextMenuItemList.length)
    {
        await vscel.menu.showQuickPick
        (
            contextMenuItemList,
            {
                placeHolder: locale.map("Select a setting context."),
                matchOnDescription: true,
                matchOnDetail: true,
                debug: debug.get("default-scope"),
            }
        );
    }
    else
    {
        await editSettingItem
        ({
            context,
            configurationTarget: vscode.ConfigurationTarget .Global,
            overrideInLanguage: false,
            entry
        });
    }
};
export const makeRollBackMethod = (pointer: SettingsPointer, value: any) =>
    async () => await setConfigurationQueue(pointer, value);
export const makeCopyKeyMenuItem = (pointer: SettingsPointer): vscel.menu.CommandMenuItem =>
({
    label: `$(key) ${locale.typeableMap("Copy key")}`,
    description: PointerToKeyString(pointer),
    command: async () => await vscode.env.clipboard.writeText(PointerToKeyString(pointer))
});
export const makeCopyValueMenuItem = (value: any): vscel.menu.CommandMenuItem =>
({
    label: `$(key) ${locale.typeableMap("Copy value")}`,
    description: JSON.stringify(value),
    command: async () => await vscode.env.clipboard.writeText(JSON.stringify(value)),
    when: () => undefined !== value
});
export const editSettingItem =
async (
    focus: SettingsFocus,
    pointer = makePointer(focus),
    oldValue = getDetailValue
    (
        getConfigurationTargetValue(pointer),
        pointer.detailId
    ),
) => await vscel.menu.showQuickPick
(
    [
        makeShowDescriptionMenu(focus, pointer),
        makeShowDeprecationMessageMenu(focus, pointer),
        makeCopyKeyMenuItem(pointer),
        makeCopyValueMenuItem(oldValue),
        {
            label: `$(discard) ${locale.typeableMap("Reset")}`,
            description:
                [
                    //undefined === getDetailValue(getDefaultValue(focus.entry, pointer), pointer.detailId) ? "default": undefined,
                    undefined === oldValue ? "current": undefined,
                ]
                .filter(i => 0 < (i?.length ?? 0))
                .join(", "),
            preview: async () => await setConfigurationQueue(pointer, undefined),
            command: async () => await setConfiguration({ pointer, newValue: undefined, oldValue, }),
        }
    ]
    .concat
    (
        await makeEditSettingValueItemList(focus, pointer, oldValue),
        makeSettingValueItemList(focus, pointer, oldValue),
        makeSettingValueEditArrayItemList(focus, pointer, oldValue),
        await makeSettingValueEditObjectItemList(focus, pointer, oldValue)
    ),
    {
        placeHolder: `${makeSettingLabel(pointer)} ( ${makeSettingIdLabel(pointer)} ):`,
        matchOnDescription: true,
        rollback: makeRollBackMethod(pointer, oldValue),
        // ignoreFocusOut: true,
        preview: isPreviewEnabled(pointer),
        debug: debug.get("default-scope"),
    }
);
export const makeSettingLabel = (pointer: SettingsPointer) => [ pointer.id, ].concat(pointer.detailId).map
    (
        i => i
        .replace(/\./mg, ": ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/(^|\s)([a-z])/g,(_s, m1, m2) => `${m1}${m2.toUpperCase()}`)
    )
    .join(" > ");
export const makeSettingIdLabel = (pointer: { id: string, detailId: string[] }) =>　[ pointer.id, ].concat(pointer.detailId).join(" > ");
export const makeConfigurationScopeUri = (configurationTarget: vscode.ConfigurationTarget): vscode.Uri | undefined =>
{
    const activeDocumentUri = vscode.window.activeTextEditor?.document.uri;
    switch(configurationTarget)
    {
    case vscode.ConfigurationTarget.Global:
        return undefined;
    case vscode.ConfigurationTarget.Workspace:
        return vscode.workspace.workspaceFile ??
            vscode.workspace.workspaceFolders?.[0]?.uri;
    case vscode.ConfigurationTarget.WorkspaceFolder:
        return activeDocumentUri ?
            vscode.workspace.getWorkspaceFolder(activeDocumentUri)?.uri:
            vscode.workspace.workspaceFolders?.[0]?.uri;
    }
    return undefined;
};
export const makeConfigurationScope = (context: SettingsContext): vscode.ConfigurationScope | null | undefined =>
{
    if (context.overrideInLanguage)
    {
        const languageId = getLanguageId();
        if (languageId)
        {
            return {
                uri: makeConfigurationScopeUri(context.configurationTarget),
                languageId: languageId,
            };
        }
    }
    return makeConfigurationScopeUri(context.configurationTarget);
};
export const getLanguageId = () => vscode.window.activeTextEditor?.document.languageId;
export const makeDisplayType = (entry: SettingsEntry) =>
{
    let result = "string" === typeof entry.type ?
        entry.type:
        JSON.stringify(entry.type);
    if ("string" === result && entry.enum)
    {
        result = "enum";
    }
    return result;
};
export const makeEditSettingDescription = (entry: SettingsEntry, value: any, hasValue: boolean) =>
    (hasValue ? "* ": "")
    + entry.id
    +(debug.get("default-scope") ? `: ${makeDisplayType(entry)}`: "")
    + " = "
    + JSON.stringify(value);
export const makeEditSettingDetail = (entry: SettingsEntry) =>
    isDeprecatedEntry(entry) ?
        `${entry.deprecationMessage ?? markdownToPlaintext(entry.markdownDeprecationMessage)} ( ${entry.description ?? markdownToPlaintext(entry.markdownDescription)} ?? "no description" )`:
        (entry.description ?? markdownToPlaintext(entry.markdownDescription));
export const makeUndoMenu = (): vscel.menu.CommandMenuItem[] =>
{
    const result: vscel.menu.CommandMenuItem[] = [];
    if (0 < undoBuffer.length)
    {
        const entry = undoBuffer[undoBuffer.length -1];
        result.push
        ({
            label: `$(debug-step-back) ${locale.typeableMap("blitz.undoSetting.title")}`,
            description: makeContextLabel(entry.pointer),
            detail: `${makeSettingLabel(entry.pointer)} : ${toStringForce(entry.newValue)} $(arrow-right) ${toStringForce(entry.oldValue)}`,
            command: async () => await UndoConfiguration(),
        });
    }
    if (0 < redoBuffer.length)
    {
        const entry = redoBuffer[redoBuffer.length -1];
        result.push
        ({
            label: `$(debug-step-over) ${locale.typeableMap("blitz.redoSetting.title")}`,
            description: makeContextLabel(entry.pointer),
            detail: `${makeSettingLabel(entry.pointer)} : ${toStringForce(entry.oldValue)} $(arrow-right) ${toStringForce(entry.newValue)}`,
            command: async () => await RedoConfiguration(),
        });
    }
    return result;
};
export const editSettings = async (context: CommandContext) =>
{
    const recentlies = getRecentlyEntries();
    return await vscel.menu.showQuickPick
    (
        makeUndoMenu()
        .concat
        (
            (await aggregateSettings(context))
            .filter(i => "launch" !== i.id) // コイツだけはいろいろ特殊なので隠蔽する
            .map
            (
                entry =>
                ({
                    entry,
                    // ここの SettingPointer は処理の都合上のダミー
                    pointer: makePointer
                    ({
                        context,
                        configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
                        overrideInLanguage: true,
                        entry,
                    })
                })
            )
            .map
            (
                i =>
                ({
                    entry: i.entry,
                    pointer: i.pointer,
                    inspectResult: inspectConfiguration(i.pointer),
                })
            )
            .map
            (
                i =>
                ({
                    entry: i.entry,
                    pointer: i.pointer,
                    value: getProjectionValueFromInspectResult(i.inspectResult),
                    hasValue: hasValueInInspectResult(i.inspectResult),
                    defaultValue: i.inspectResult?.defaultLanguageValue ?? i.inspectResult?.defaultValue,
                })
            )
            .sort
            (
                vscel.comparer.make
                ([
                    a => recentlies.concat(a.entry.id).indexOf(a.entry.id),
                    a => a.hasValue ? 0: 1
                ])
            )
            .map
            (
                i =>
                ({
                    label: `${isDeprecatedEntry(i.entry) ? "$(warning)": "$(settings-gear)"} ${makeSettingLabel(i.pointer)}`,
                    description: makeEditSettingDescription(i.entry, i.value, i.hasValue),
                    detail: makeEditSettingDetail(i.entry),
                    command: async () => await selectContext(context, await resolveReference(context, i.entry)),
                })
            )
        ),
        {
            placeHolder: locale.map("Select a setting item."),
            matchOnDescription: true,
            matchOnDetail: true,
            debug: debug.get("default-scope"),
        }
    );
};
const alignmentObject = Object.freeze
({
    "none": undefined,
    "left": vscode.StatusBarAlignment.Left,
    "right": vscode.StatusBarAlignment.Right,
});
export const statusBarAlignment = configRoot.makeMapEntry("blitz.statusBar.Alignment", "root-workspace", alignmentObject);
export const statusBarLabel = configRoot.makeEntry<string>("blitz.statusBar.Label", "root-workspace");
export const makeStatusBarItem = (alignment: vscode.StatusBarAlignment) => vscel.statusbar.createItem
({
    alignment,
    //text: statusBarLabel.get("default"),
    command: `blitz.editSetting`,
    tooltip: locale.map("blitz.editSetting.title"),
});
const leftStatusBarItem = makeStatusBarItem(vscode.StatusBarAlignment.Left);
const rightStatusBarItem = makeStatusBarItem(vscode.StatusBarAlignment.Right);
export const updateStatusBarItem = () =>
    [
        leftStatusBarItem,
        rightStatusBarItem,
    ]
    .forEach
    (
        item =>
        {
            if (item.alignment === statusBarAlignment.get("default-scope"))
            {
                item.text = statusBarLabel.get("default-scope");
                item.show();
            }
            else
            {
                item.hide();
            }
        }
    );
export const onDidUpdateConfig = async () =>
{
    updateStatusBarItem();
    await setContext('isBlitzDebugMode', debug.get("default-scope"));
};
let extensionContext: vscode.ExtensionContext;
export const activate = async (context: vscode.ExtensionContext) =>
{
    extensionContext = context;
    context.subscriptions.push
    (
        vscode.commands.registerCommand
        (
            'blitz.editSetting',
            async () => editSettings(new CommandContext()),
        ),
        vscode.commands.registerCommand
        (
            'blitz.undoSetting',
            async () => await UndoConfiguration(),
        ),
        vscode.commands.registerCommand
        (
            'blitz.redoSetting',
            async () => await RedoConfiguration(),
        ),
        vscode.commands.registerCommand
        (
            'blitz.clearHistory',
            async () => await clearRecentlies(),
        ),
        leftStatusBarItem,
        rightStatusBarItem,
        vscode.workspace.onDidChangeConfiguration
        (
            async (event) =>
            {
                if
                (
                    event.affectsConfiguration("blitz")
                )
                {
                    //configRoot.entries.forEach(i => i.clear());
                    await onDidUpdateConfig();
                }
            }
        ),
    );
    await onDidUpdateConfig();
};
export const deactivate = ( ) => { };
