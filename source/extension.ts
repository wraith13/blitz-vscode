import * as vscode from 'vscode';
import * as Config from "./lib/config";
type PrimaryConfigurationType = "null" | "boolean" | "string" | "integer" | "number" | "array" | "object";
type ConfigurationType = PrimaryConfigurationType | PrimaryConfigurationType[];
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
    minimum?: number;
    maximum?: number;
    overridable?: boolean;
    description?: string;
    enumDescriptions?: string[];
    markdownDescription?: string;
    markdownEnumDescriptions?: string[];
    tags?: string[];
    allOf?: PackageJsonConfigurationProperty[];
}
interface PackageJsonConfiguration extends PackageJsonConfigurationBase
{
    id?: string;
    order?: number;
    type?: ConfigurationType;
    title: string;
}
interface PackageJsonContributes
{
    configuration: PackageJsonConfiguration;
    configurationDefaults: object;
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
const makePointer = (focus: SettingsFocus): SettingsPointer =>
({
    configurationTarget: focus.configurationTarget,
    overrideInLanguage: focus.overrideInLanguage,
    id: focus.entry.id,
    scope: makeConfigurationScope(focus),
});
interface SettingsPointer extends SettingsContext
{
    id: string;
    scope: vscode.ConfigurationScope | null | undefined;
}
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
    if (current && "object" === typeof current)
    {
        if (Array.isArray(current))
        {
            await Promise.all(current.map(i => resolveReference(context, self, i)));
        }
        else
        {
            if ("string" === typeof current.$ref)
            {
                await loadReference(context, self, current, current.$ref);
                current.$ref = undefined;
            }
            else
            {
                await Promise.all
                (
                    Object
                        .keys(current)
                        .map(key => resolveReference(context, self, (<any>current)[key]))
                );
            }
        }
    }
    return current;
};
const getVscodeSettings = async (context: CommandContext): Promise <SchemasSettingsDefault> => <SchemasSettingsDefault> await getSchema(context, "vscode://schemas/settings/default");
export interface CommandMenuItem extends vscode.QuickPickItem
{
    preview?: () => Promise<unknown>;
    command?: () => Promise<unknown>;
}
export interface QuickPickOptions extends vscode.QuickPickOptions
{
    rollback?: () => Promise<unknown>;
    strictRollback?: () => Promise<unknown>;
}
export const showQuickPick = async <T extends CommandMenuItem>
(
    items: T[] | Thenable<T[]>,
    options?: QuickPickOptions,
    token?: vscode.CancellationToken
) =>
{
    let lastPreview = options ?.strictRollback ?? options ?.rollback;
    const apply = async (method: (() => Promise<unknown>) | undefined) =>
    {
        if (method && lastPreview !== method)
        {
            lastPreview = method;
            await method();
            return true;
        }
        return false;
    };
    const result = await vscode.window.showQuickPick
    (
        items,
        Object.assign
        (
            {
                onDidSelectItem: async (item: T) =>
                {
                    await apply(options?.strictRollback);
                    await apply(item.preview) || await apply(options?.rollback);
                }
            },
            options ?? { },
        ),
        token
    );
    await apply(options?.strictRollback);
    if (result)
    {
        await apply(result.command) || await apply(result.preview);
    }
    else
    {
        await apply(options ?.rollback);
    }
    return result;
};
export const getDefaultValue = (entry: SettingsEntry) =>
{
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
    .map(i => (<PackageJson>i?.packageJSON)?.contributes?.configuration)
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
export const makeConfigurationSection = (id: string) => id.replace(/^(.*)(\.)([^.]*)$/, "$1");
export const makeConfigurationKey = (id: string) => id.replace(/^(.*)(\.)([^.]*)$/, "$3");
export const aggregateSettings = async (context: CommandContext) =>
{
    const vscodeSettings = await getVscodeSettings(context);
    const keys = Object.keys(vscodeSettings.properties);
    const recentlies = getRecentlies();
    const ids = recentlies
        .filter(i => 0 <= keys.indexOf(i))
        .concat(keys.filter(i => recentlies.indexOf(i) < 0));
    return ids
        .map
        (
            id => Object.assign
            (
                {
                    id,
                },
                vscodeSettings.properties[id]
            )
        );
};
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
<T>(
    context:
    {
        configurationTarget: vscode.ConfigurationTarget,
        overrideInLanguage: boolean,
    },
    inspect:
    {
        key: string,
        defaultValue?: T,
        globalValue?: T,
        workspaceValue?: T,
        workspaceFolderValue?: T,
        defaultLanguageValue?: T,
        globalLanguageValue?: T,
        workspaceLanguageValue?: T,
        workspaceFolderLanguageValue?: T,
        languageIds?: string[],
    } | undefined
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
export const getConfiguration = <T>(pointer: SettingsPointer): T | undefined => vscode.workspace.getConfiguration
(
    makeConfigurationSection(pointer.id),
    pointer.scope
)
.get<T>
(
    makeConfigurationKey(pointer.id)
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
    value,
    pointer.configurationTarget,
    pointer.overrideInLanguage
);
const configurationQueue:
{
    pointer: SettingsPointer,
    value: unknown,
    resolve: () => void,
    rejct: () => void,
}[]  = [];
export const timeout = (wait: number) => new Promise((resolve) => setTimeout(resolve, wait));
export const setConfigurationQueue =
async (
    pointer: SettingsPointer,
    value: unknown
) => new Promise
(
    async (resolve, rejct) =>
    {
        if (0 < configurationQueue.length)
        {
            const removeList = configurationQueue
                .filter(i => JSON.stringify(i.pointer) === JSON.stringify(pointer))
                .map((_i, ix) => ix);
            removeList.forEach(i => configurationQueue[i].rejct());
            removeList.reverse().forEach(i => configurationQueue.splice(i, 1));
            configurationQueue.push({ pointer, value, resolve, rejct });
        }
        else
        {
            configurationQueue.push({ pointer, value, resolve, rejct });
            while(true)
            {
                await timeout(1000);
                const i = configurationQueue.splice(0, 1)[0];
                const isLast = configurationQueue.length <= 0; // このタイミングでチェックしておかないとここのループが多重に動作する事になる。
                try
                {
                    await setConfigurationRaw(i.pointer, i.value);
                }
                finally
                {
                    i.resolve();
                }
                if (isLast)
                {
                    break;
                }
            }
        }
    }
);
interface UndoEntry
{
    pointer: SettingsPointer;
    newValue: unknown;
    oldValue: unknown;
};
const recentliesStrageId = `wraith13.blitz.recentlies`;
const getRecentlies = () => extensionContext.globalState.get<string[]>(recentliesStrageId) || [];
const setRecentlies = async (id: string) =>
{
    const recentlies = getRecentlies();
    const oldIndex = recentlies.indexOf(id);
    if (0 <= oldIndex)
    {
        recentlies.splice(oldIndex, 1);
    }
    recentlies.splice(0, 0, id);
    recentlies.splice(128);
    await extensionContext.globalState.update(recentliesStrageId, recentlies);
};
const undoBuffer: UndoEntry[] = [];
const redoBuffer: UndoEntry[] = [];
const makeUndoEntry =
(
    pointer: SettingsPointer,
    newValue: unknown,
    oldValue: unknown = getValueFromInspectResult
    (
        pointer,
        inspectConfiguration(pointer)
    )
) => ({ pointer, oldValue, newValue, });
export const setConfiguration = async (entry: UndoEntry) =>
{
    redoBuffer.splice(0, redoBuffer.length);
    undoBuffer.push(entry);
    await onDidUpdateUndoBuffer();
    await setConfigurationQueue(entry.pointer, entry.newValue);
    await setRecentlies(entry.pointer.id);
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
export const onDidUpdateUndoBuffer = async () =>
{
    await vscode.commands.executeCommand
    (
        'setContext',
        'isUndosableBlitz',
        0 < undoBuffer.length
    );
    await vscode.commands.executeCommand
    (
        'setContext',
        'isRedosableBlitz',
        0 < redoBuffer.length
    );
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
    detail?: string
) =>
({
    label: `$(tag) ${JSON.stringify(entry.newValue)}`,
    description,
    detail,
    preview: async () => await setConfigurationQueue(entry.pointer, entry.newValue),
    command: async () => await setConfiguration(entry),
});
export const makeSettingValueItemList = (focus: SettingsFocus, oldValue: any): CommandMenuItem[] =>
{
    const pointer = makePointer(focus);
    const entry = focus.entry;
    const list: { value: any, description: string[], detail?: string }[ ] = [ ];
    const register = (value: any, description?: string, detail?: string) =>
    {
        const item = list.filter(i => JSON.stringify(i.value) === JSON.stringify(value))[0];
        if (item)
        {
            if (undefined !== description)
            {
                item.description.push(description);
            }
            if (undefined !== detail)
            {
                item.detail = detail;
            }
        }
        else
        {
            list.push
            ({
                value,
                description: undefined !== description ? [ description ]: [ ],
                detail,
            });
        }
    };
    const types = ("string" === typeof entry.type ? [ entry.type ]: entry.type);
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
    register(getDefaultValue(entry), "default");
    register(getConfiguration(pointer), "current");
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
        (a, b) =>
        {
            const aTypeIndex = typeIndexOf(a.value);
            const bTypeIndex = typeIndexOf(b.value);
            if (aTypeIndex < bTypeIndex)
            {
                return -1;
            }
            if (aTypeIndex > bTypeIndex)
            {
                return 1;
            }
            if (typeof a.value === typeof b.value)
            {
                if (entry.enum)
                {
                    const aEnumIndex = entry.enum.indexOf(a.value);
                    const bEnumIndex = entry.enum.indexOf(b.value);
                    if (aEnumIndex < bEnumIndex)
                    {
                        return -1;
                    }
                    if (aEnumIndex > bEnumIndex)
                    {
                        return 1;
                    }
                }
                if ("number" === typeof a.value && "number" === typeof b.value)
                {
                    if (a < b)
                    {
                        return -1;
                    }
                    if (a > b)
                    {
                        return 1;
                    }
                }
                if ("string" === typeof a.value && "string" === typeof b.value)
                {
                    if (a < b)
                    {
                        return -1;
                    }
                    if (a > b)
                    {
                        return 1;
                    }
                }
                if ("object" === typeof a.value && "object" === typeof b.value)
                {
                    const aJson = JSON.stringify(a.value);
                    const bJson = JSON.stringify(b.value);
                    if (aJson < bJson)
                    {
                        return -1;
                    }
                    if (aJson > bJson)
                    {
                        return 1;
                    }
                }
            }
            else
            {
                console.log(`Uncomparable values: ${JSON.stringify({ a, b })}`);
            }
            return 0;
        }
    );
    return list.map
    (
        i => makeSettingValueItem
        (
            makeUndoEntry(pointer, i.value, oldValue),
            0 < i.description.length ? i.description.join(", "): undefined,
            i.detail
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
    focus: SettingsFocus,
    oldValue: any,
    //validateInput: (input: string) => string | undefined | null | Thenable<string | undefined | null>,
    validateInput: (input: string) => string | undefined | null,
    parser: (input: string) => unknown,
    value: string = toStringOrUndefined(oldValue)
) =>
{
    const pointer = makePointer(focus);
    const rollback = makeRollBackMethod(pointer, oldValue);
    const input = await vscode.window.showInputBox
    ({
        value,
        validateInput: async (input) =>
        {
            const result = validateInput(input);
            if (undefined === result || null === result)
            {
                await setConfigurationQueue(pointer, parser(input));
            }
            return result;
        }
    });
    if (undefined !== input)
    {
        const newValue = parser(input);
        await setConfiguration({ pointer, newValue, oldValue, });
    }
    else
    {
        rollback();
    }
};
export const toStringOfDefault = (value: any, defaultValue: any) =>
    undefined === value ?
        defaultValue:
        (
            "string" === typeof value ?
                value:
                JSON.stringify(value)
        );
export const toStringOrUndefined = (value: any) => toStringOfDefault(value, undefined);
export const toStringForce = (value: any) => toStringOfDefault(value, "undefined" );
export const makeEditSettingValueItemList = async (focus: SettingsFocus, oldValue: any): Promise<CommandMenuItem[]> =>
{
    const entry = focus.entry;
    const result: CommandMenuItem[] = [ ];
    const value = toStringOrUndefined(await getDefaultValue(entry));
    if (undefined === entry.enum && hasType(entry, "string"))
    {
        result.push
        ({
            label: "$(edit) Input string",
            command: async () => await editSettingValue
            (
                focus,
                oldValue,
                () => undefined,
                input => input,
                value
            )
        });
    }
    if (hasType(entry, "integer"))
    {
        result.push
        ({
            label: "$(edit) Input integer",
            command: async () => await editSettingValue
            (
                focus,
                oldValue,
                input =>
                {
                    const value = parseInt(input);
                    if (isNaN(value) || value !== parseFloat(input))
                    {
                        return "invalid integer";
                    }
                    if (undefined !== entry.minimum && value < entry.minimum)
                    {
                        return `minimum: ${entry.minimum}`;
                    }
                    if (undefined !== entry.maximum && entry.maximum < value)
                    {
                        return `maximum: ${entry.maximum}`;
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
            label: "$(edit) Input number",
            command: async () => await editSettingValue
            (
                focus,
                oldValue,
                input =>
                {
                    const value = parseFloat(input);
                    if (isNaN(value))
                    {
                        return "invalid number";
                    }
                    if (undefined !== entry.minimum && value < entry.minimum)
                    {
                        return `minimum: ${entry.minimum}`;
                    }
                    if (undefined !== entry.maximum && entry.maximum < value)
                    {
                        return `maximum: ${entry.maximum}`;
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
            label: "$(edit) Input array",
            command: async () => await editSettingValue
            (
                focus,
                oldValue,
                input =>
                {
                    try
                    {
                        const value = JSON.parse(input);
                        if ("object" !== typeof value)
                        {
                            return "invalid array";
                        }
                        if ( ! Array.isArray(value))
                        {
                            return "invalid array";
                        }
                    }
                    catch
                    {
                        return "invalid array";
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
            label: "$(edit) Input object",
            command: async () => await editSettingValue
            (
                focus,
                oldValue,
                input =>
                {
                    try
                    {
                        const value = JSON.parse(input);
                        if ("object" !== typeof value)
                        {
                            return "invalid object";
                        }
                        if (Array.isArray(value))
                        {
                            return "invalid object";
                        }
                    }
                    catch
                    {
                        return "invalid object";
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
export const makeSettingValueEditArrayItemList = (focus: SettingsFocus, oldValue: any): CommandMenuItem[] =>
{
    const pointer = makePointer(focus);
    const entry = focus.entry;
    const result: CommandMenuItem[] = [ ];
    if (hasType(entry, "array"))
    {
        const array = getConfiguration <any[]> (pointer) ?? [ ];
        if (Array.isArray(array))
        {
            if (entry.items?.type && hasType(entry.items, "null"))
            {
                const newValue = array.concat([ null ]);
                result.push
                ({
                    label: `$(add) Add null item`,
                    preview: async () => await setConfigurationQueue(pointer, newValue),
                    command: async () => await setConfiguration({ pointer, newValue, oldValue, }),
                }); }
            if ( ! entry.items?.type || hasType(entry.items, "string"))
            {
                result.push
                ({
                    label: `$(add) Add string item`,
                    command: async () => await editSettingValue
                    (
                        focus,
                        oldValue,
                        () => undefined,
                        input => array.concat([ input ]),
                        "",
                    )
                });
            }
            array.forEach
            (
                (item, index) =>
                {
                    const newValue = array.filter(_ => true).splice(index, 1);
                    result.push
                    ({
                        label: `$(remove) Remove "${toStringOrUndefined(item)}"`,
                        preview: async () => await setConfigurationQueue(pointer, newValue),
                        command: async () => await setConfiguration({ pointer, newValue, oldValue, }),
                    });
                }
            );
        }
    }
    return result;
};
export const makeFullDescription = (entry: SettingsEntry) =>
{
    let description = entry.description ?? markdownToPlaintext(entry.markdownDescription) ?? "(This setting item has no description)";
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
    }
): CommandMenuItem =>
({
    label: `$(comment) Show Full Description`,
    description: focus.entry.id,
    command: async () =>
    {
        const editThisSettingItem = "Edit this setting item"; //"この設定項目を編集...";
        const editOtherSetingItem = "Edit other setting item"; //"別の設定項目を選択...";
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
                await editSettingItem(<SettingsFocus>focus):
                await selectContext(focus.context, focus.entry);
            break;
        case editOtherSetingItem:
            await editSettings(focus.context);
            break;
        }
    },
});
export const makeContextLabel = (pointer: SettingsPointer) =>
{
    const languageId = (<{ uri: vscode.Uri | undefined, languageId: string, }>(<SettingsPointer>pointer).scope)?.languageId;
    if (languageId)
    {
        switch(pointer.configurationTarget)
        {
        case vscode.ConfigurationTarget.Global:
            return `Global[lang:${languageId}]`;
        case vscode.ConfigurationTarget.Workspace:
            return `Workspace[lang:${languageId}]`;
        case vscode.ConfigurationTarget.WorkspaceFolder:
            return `WorkspaceFolder[lang:${languageId}]`;
        default:
            return `UNKNOWN[lang:${languageId}]`;
        }
    }
    else
    {
        switch(pointer.configurationTarget)
        {
        case vscode.ConfigurationTarget.Global:
            return `Global`;
        case vscode.ConfigurationTarget.Workspace:
            return `Workspace`;
        case vscode.ConfigurationTarget.WorkspaceFolder:
            return `WorkspaceFolder`;
        default:
            return `UNKNOWN`;
        }
    }
};
export const makeContextMenuItem = (focus: SettingsFocus, value: string, description: string | undefined): CommandMenuItem =>
({
    label: `$(symbol-namespace) ${makeContextLabel(makePointer(focus))}: ${value}`,
    description,
    command: async () => await editSettingItem(focus),
});
export const selectContext = async (context: CommandContext, entry: SettingsEntry) =>
{
    console.log(`selectContext.entry: ${ JSON.stringify(entry)}`);
    const contextMenuItemList: CommandMenuItem[] = [ ];
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
    const workspaceOverridable = 0 < (vscode.workspace.workspaceFolders?.length ?? 0) &&
        (undefined === entry.scope || (ConfigurationScope.APPLICATION !== entry.scope && ConfigurationScope.MACHINE !== entry.scope));
    const workspaceFolderOverridable = 1 < (vscode.workspace.workspaceFolders?.length ?? 0) &&
        (undefined === entry.scope || (ConfigurationScope.APPLICATION !== entry.scope && ConfigurationScope.MACHINE !== entry.scope && ConfigurationScope.WINDOW !== entry.scope));
    const languageOverridable = languageId &&
        (entry.overridable || undefined === entry.scope || ConfigurationScope.LANGUAGE_OVERRIDABLE === entry.scope);
    const makeDescription = (defaultValue: any, value: any) => undefined !== value && value === defaultValue ? "default": undefined;
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
                    toStringForce((undefined !== values?.globalLanguageValue) ? values?.globalLanguageValue: values?.defaultLanguageValue),
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
        await showQuickPick
        (
            [ makeShowDescriptionMenu({context, entry}), ].concat(contextMenuItemList),
            {
                placeHolder: "Select a setting context.",
                matchOnDescription: true,
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
export const editSettingItem =
async (
    focus: SettingsFocus,
    pointer =  makePointer(focus),
    oldValue = getValueFromInspectResult
    (
        focus,
        inspectConfiguration(pointer)
    ),
) => await showQuickPick
(
    [
        makeShowDescriptionMenu(focus),
        {
            label: "$(discard) Reset",
            preview: async () => await setConfigurationQueue(pointer, undefined),
            command: async () => await setConfiguration({ pointer, newValue: undefined, oldValue, }),
        }
    ]
    .concat
    (
        await makeEditSettingValueItemList(focus, oldValue),
        makeSettingValueItemList(focus, oldValue),
        makeSettingValueEditArrayItemList(focus, oldValue)
    ),
    {
        placeHolder: `${makeSettingLabel(focus.entry.id)} ( ${focus.entry.id} ):`,
        rollback: makeRollBackMethod(pointer, oldValue),
        // ignoreFocusOut: true,
    }
);
export const makeSettingLabel = (id: string) =>　id
    .replace(/\./mg, ": ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/(^|\s)([a-z])/g,(_s, m1, m2) => `${m1}${m2.toUpperCase()}`);
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
export const makeEditSettingDescription = (entry: SettingsEntry, value: any) =>
    (
        JSON.stringify(getDefaultValue(entry)) === JSON.stringify(value) ?
            "":
            "* "
    )
    + entry.id
    + ": "
    + makeDisplayType(entry)
    + " = "
    + JSON.stringify(value);
export const makeUndoMenu = (): CommandMenuItem[] =>
{
    const result: CommandMenuItem[] = [];
    if (0 < undoBuffer.length)
    {
        const entry = undoBuffer[undoBuffer.length -1];
        result.push
        ({
            label: `$(debug-step-back) Undo`,
            detail: `${makeSettingLabel(entry.pointer.id)}(${makeContextLabel(entry.pointer)}): ${toStringForce(entry.newValue)} $(arrow-right) ${toStringForce(entry.oldValue)}`,
            command: async () => await UndoConfiguration(),
        });
    }
    if (0 < redoBuffer.length)
    {
        const entry = redoBuffer[redoBuffer.length -1];
        result.push
        ({
            label: `$(debug-step-over) Redo`,
            description: makeContextLabel(entry.pointer),
            detail: `${makeSettingLabel(entry.pointer.id)}(${makeContextLabel(entry.pointer)}): ${toStringForce(entry.oldValue)} $(arrow-right) ${toStringForce(entry.newValue)}`,
            command: async () => await RedoConfiguration(),
        });
    }
    return result;
};
export const editSettings = async (context: CommandContext) => await showQuickPick
(
    makeUndoMenu()
    .concat
    (
        (await aggregateSettings(context) ) .map
        (
            entry =>
            ({
                label: `$(settings-gear) ${makeSettingLabel(entry.id)}`,
                description: makeEditSettingDescription
                (
                    entry,
                    getConfiguration
                    (
                        makePointer
                        ({
                            context,
                            configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
                            overrideInLanguage: true,
                            entry,
                        })
                    )
                ),
                detail: entry.description ?? markdownToPlaintext(entry.markdownDescription),
                command: async () => await selectContext(context, await resolveReference(context, entry)),
            })
        )
    ),
    {
        placeHolder: "Select a setting item.",
        matchOnDescription: true,
    }
);

const alignmentObject = Object.freeze
(
    {
        "none": undefined,
        "left": vscode.StatusBarAlignment.Left,
        "right": vscode.StatusBarAlignment.Right,
    }
);
export const statusBarAlignment = new Config.MapEntry("blitz.statusBar.Alignment", alignmentObject);
export const statusBarLabel = new Config.Entry<string>("blitz.statusBar.Label");
const createStatusBarItem =
(
    properties :
    {
        alignment ? : vscode.StatusBarAlignment,
        text ? : string,
        command ? : string,
        tooltip ? : string
    }
)
: vscode.StatusBarItem =>
{
    const result = vscode.window.createStatusBarItem(properties.alignment);
    if (undefined !== properties.text)
    {
        result.text = properties.text;
    }
    if (undefined !== properties.command)
    {
        result.command = properties.command;
    }
    if (undefined !== properties.tooltip)
    {
        result.tooltip = properties.tooltip;
    }
    return result;
};
export const makeStatusBarItem = (alignment: vscode.StatusBarAlignment) => createStatusBarItem
({
    alignment,
    //text: statusBarLabel.get(""),
    command: `blitz.editSetting`,
    tooltip: `Blitz: Edit Setting`
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
            if (item.alignment === statusBarAlignment.get(""))
            {
                item.text = statusBarLabel.get("");
                item.show();
            }
            else
            {
                item.hide();
            }
        }
    );
let extensionContext: vscode.ExtensionContext;
export const activate = (context: vscode.ExtensionContext) =>
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
        leftStatusBarItem,
        rightStatusBarItem,
        vscode.workspace.onDidChangeConfiguration
        (
            event =>
            {
                if
                (
                    event.affectsConfiguration("blitz")
                )
                {
                    [
                        statusBarAlignment,
                        statusBarLabel
                    ]
                    .forEach(i => i.clear());
                    updateStatusBarItem();
                }
            }
        ),
    );
    updateStatusBarItem();
};
export const deactivate = ( ) => { };
