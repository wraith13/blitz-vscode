import * as vscode from 'vscode';
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
interface SettingsFocus
{
    context: CommandContext;
    configurationTarget: vscode.ConfigurationTarget;
    overrideInLanguage: boolean;
    entry: SettingsEntry;
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
    return Object.keys(vscodeSettings.properties)
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
export const inspectConfiguration = <T>(focus: SettingsFocus) => vscode.workspace.getConfiguration
(
    makeConfigurationSection(focus.entry.id),
    makeConfigurationScope(focus)
)
.inspect<T>
(
    makeConfigurationKey(focus.entry.id)
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
export const getConfiguration = <T>(focus: SettingsFocus): T | undefined => vscode.workspace.getConfiguration
(
    makeConfigurationSection(focus.entry.id),
    makeConfigurationScope(focus)
)
.get<T>
(
    makeConfigurationKey(focus.entry.id)
);
export const setConfigurationRaw = async <T>
(
    focus: SettingsFocus,
    value: T
) => await vscode.workspace.getConfiguration
(
    makeConfigurationSection(focus.entry.id),
    makeConfigurationScope(focus)
)
.update
(
    makeConfigurationKey(focus.entry.id),
    value,
    focus.configurationTarget,
    focus.overrideInLanguage
);
interface UndoEntry
{
    focus: SettingsFocus;
    oldValue: any;
    newValue: any;
};
const undoBuffer: UndoEntry[] = [];
const redoBuffer: UndoEntry[] = [];
export const setConfiguration = async <T>
(
    focus: SettingsFocus,
    value: T
) =>
{
    const entry: UndoEntry =
    {
        focus,
        oldValue: getValueFromInspectResult
        (
            focus,
            inspectConfiguration(focus)
        ),
        newValue: value,
    };
    redoBuffer.splice(0, redoBuffer.length);
    undoBuffer.push(entry);
    await setConfigurationRaw(entry.focus, entry.newValue);
};
export const UndoConfiguration = async () =>
{
    const entry = undoBuffer.pop();
    if (undefined !== entry)
    {
        redoBuffer.push(entry);
        await setConfigurationRaw(entry.focus, entry.oldValue);
    }
};
export const RedoConfiguration = async () =>
{
    const entry = redoBuffer.pop();
    if (undefined !== entry)
    {
        undoBuffer.push(entry);
        await setConfigurationRaw(entry.focus, entry.newValue);
    }
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
export const makeSettingValueItem = <T>
(
    focus: SettingsFocus,
    oldValue: T,
    newValue: T,
    description?: string,
    detail?: string
) =>
({
    label: `$(tag) ${JSON.stringify(newValue)}`,
    description,
    detail,
    preview: async () => await setConfigurationRaw(focus, newValue),
    command: async () => undoBuffer.push({ focus, oldValue, newValue}),
});
export const makeSettingValueItemList = (focus: SettingsFocus, oldValue: any): CommandMenuItem[] =>
{
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
    register(getConfiguration(focus), "current");
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
            focus,
            i.value,
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
    //validateInput: (input: string) => string | undefined | null | Thenable<string | undefined | null>,
    validateInput: (input: string) => string | undefined | null,
    parser: (input: string) => unknown
) =>
{
    const rollback = makeRollBackMethod(focus);
    const input = await vscode.window.showInputBox
    ({
        value: toStringOrUndefined
        (
            await getConfiguration(focus)
        ),
        validateInput: async (input) =>
        {
            const result = validateInput(input);
            if (undefined === result || null === result)
            {
                await setConfiguration
                (
                    focus,
                    parser(input)
                );
            }
            return result;
        }
    });
    if (undefined === input)
    {
        rollback();
    }
};
export const toStringOfDefault = (value: any, defaultValue: any) => undefined === value ?
    defaultValue:
    JSON.stringify(value);
export const toStringOrUndefined = (value: any) => toStringOfDefault(value, undefined);
export const toStringForce = (value: any) => toStringOfDefault(value, "undefined" );
export const makeEditSettingValueItemList = (focus: SettingsFocus, oldValue: any): CommandMenuItem[] =>
{
    const entry = focus.entry;
    const result: CommandMenuItem[] = [ ];
    if (undefined === entry.enum && hasType(entry, "string"))
    {
        result.push
        ({
            label: "$(edit) Input string",
            command: async () => await editSettingValue
            (
                focus,
                () => undefined,
                input => input
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
                input => parseInt(input)
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
                input => parseFloat(input)
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
                input => JSON.parse(input)
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
                input => JSON.parse(input)
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
    const entry = focus.entry;
    const result: CommandMenuItem[] = [ ];
    if (hasType(entry, "array"))
    {
        const array = getConfiguration <any[]> (focus) ?? [ ];
        if (Array.isArray(array))
        {
            if (entry.items?.type && hasType(entry.items, "null"))
            {
                result.push
                ({
                    label: `$(add) Add null item`,
                    preview: async () => await setConfiguration
                    (
                        focus,
                        array.concat([ null ])
                    ),
                });
            }
            if ( ! entry.items?.type || hasType(entry.items, "string"))
            {
                result.push
                ({
                    label: `$(add) Add string item`,
                    command: async () =>
                    {
                        const input = await vscode.window.showInputBox({ });
                        if (undefined !== input)
                        {
                            await setConfiguration
                            (
                                focus,
                                array.concat([ input ])
                            );
                        }
                    }
                });
            }
            array.forEach
            (
                (item, index) => result.push
                ({
                    label: `$(remove) Remove "${toStringOrUndefined(item)}"`,
                    preview: async () => await setConfiguration
                    (
                        focus,
                        array.filter(_ => true).splice(index, 1)
                    ),
                })
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
    label: `Show Full Description`,
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
export const selectContext = async (context: CommandContext, entry: SettingsEntry) =>
{
    console.log(`selectContext.entry: ${ JSON.stringify(entry)}`);
    const contextMenuItemList: CommandMenuItem[] = [ ];
    const languageId = getLanguageId();
    const values = inspectConfiguration
    ({
        context,
        configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
        overrideInLanguage: true,
        entry
    });
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
        ({
            label: `Global: ${toStringForce((undefined !== values?.globalValue)? values?.globalValue: values?.defaultValue)}`,
            description: makeDescription(values?.defaultValue, values?.globalValue ?? values?.defaultValue),
            command: async () => await editSettingItem
            ({
                context,
                configurationTarget: vscode.ConfigurationTarget.Global,
                overrideInLanguage: false,
                entry
            })
        });
        if (workspaceOverridable)
        {
            contextMenuItemList.push
            ({
                label: `WorkspaceFolder: ${toStringForce(values?.workspaceValue)}`,
                description: makeDescription(values?.defaultValue, values?.workspaceValue),
                command: async () => await editSettingItem
                ({
                    context,
                    configurationTarget: vscode.ConfigurationTarget.Workspace,
                    overrideInLanguage: false,
                    entry
                })
            });
        }
        if (workspaceFolderOverridable)
        {
            contextMenuItemList.push
            ({
                label: `WorkspaceFolder: ${toStringForce(values?.workspaceFolderValue)}`,
                description: makeDescription(values?.defaultValue, values?.workspaceFolderValue),
                command: async () => await editSettingItem
                ({
                    context,
                    configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
                    overrideInLanguage: false,
                    entry
                })
            });
        }
        if (languageOverridable)
        {
            contextMenuItemList.push
            ({
                label: `Global(lang:${languageId}): ${toStringForce((undefined !== values?.globalLanguageValue) ? values?.globalLanguageValue: values?.defaultLanguageValue)}`,
                description: makeDescription(values?.defaultLanguageValue, values?.globalLanguageValue),
                command: async () => await editSettingItem
                ({
                    context,
                    configurationTarget: vscode.ConfigurationTarget.Global,
                    overrideInLanguage: true,
                    entry
                })
            });
            if (workspaceOverridable)
            {
                contextMenuItemList.push
                ({
                    label: `WorkspaceFolder(lang:${languageId}): ${toStringForce(values?.workspaceLanguageValue)}`,
                    description: makeDescription(values?.defaultLanguageValue, values?.workspaceLanguageValue),
                    command: async () => await editSettingItem
                    ({
                        context,
                        configurationTarget: vscode.ConfigurationTarget.Workspace,
                        overrideInLanguage: true,
                        entry
                    })
                });
            }
            if (workspaceFolderOverridable)
            {
                contextMenuItemList.push
                ({
                    label: `WorkspaceFolder(lang:${languageId}): ${toStringForce(values?.workspaceFolderLanguageValue)}`,
                    description: makeDescription(values?.defaultLanguageValue, values?.workspaceFolderLanguageValue),
                    command: async () => await editSettingItem
                    ({
                        context,
                        configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
                        overrideInLanguage: true,
                        entry
                    })
                });
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
export const makeRollBackMethod = (focus: SettingsFocus, value: any) =>
    async () => await setConfigurationRaw(focus, value);
export const editSettingItem =
async (
    focus: SettingsFocus,
    oldValue = getValueFromInspectResult
    (
        focus,
        inspectConfiguration(focus)
    )
) => await showQuickPick
(
    [
        makeShowDescriptionMenu(focus),
        {
            label: "$(discard) Reset",
            preview: async () => await setConfigurationRaw(focus, undefined),
            command: async () => undoBuffer.push({ focus, oldValue, newValue: undefined}),
        }
    ]
    .concat
    (
        makeEditSettingValueItemList(focus, oldValue),
        makeSettingValueItemList(focus, oldValue),
        makeSettingValueEditArrayItemList(focus, oldValue)
    ),
    {
        placeHolder: `${makeSettingLabel(focus.entry)} ( ${focus.entry.id} ):`,
        rollback: makeRollBackMethod(focus, oldValue),
        // ignoreFocusOut: true,
    }
);
export const makeSettingLabel = (entry: SettingsEntry) =>　entry.id
    .replace(/\./mg, ": ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/(^|\s)([a-z])/g,(_s, m1, m2) => `${m1}${m2.toUpperCase()}`);
export const makeConfigurationScope =
(
    context:
    {
        configurationTarget: vscode.ConfigurationTarget,
        overrideInLanguage: boolean,
    }
) =>
{
    const activeDocumentUri = vscode.window.activeTextEditor?.document.uri;
    if (activeDocumentUri && context.overrideInLanguage)
    {
        return activeDocumentUri;
    }
    switch(context.configurationTarget)
    {
    case vscode.ConfigurationTarget.Global:
        return undefined;
    case vscode.ConfigurationTarget.Workspace:
        return vscode.workspace.workspaceFile ??
            vscode.workspace.workspaceFolders?.[0];
    case vscode.ConfigurationTarget.WorkspaceFolder:
        return activeDocumentUri ?
            vscode.workspace.getWorkspaceFolder(activeDocumentUri):
            vscode.workspace.workspaceFolders?.[0];
    }
    return undefined;
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
export const editSettings = async (context: CommandContext) => await showQuickPick
(
    (await aggregateSettings(context) ) .map
    (
        entry =>
        ({
            label: makeSettingLabel(entry),
            description: makeEditSettingDescription
            (
                entry,
                getConfiguration
                ({
                    context,
                    configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
                    overrideInLanguage: true,
                    entry
                })
            ),
            detail: entry.description ?? markdownToPlaintext(entry.markdownDescription),
            command: async () => await selectContext(context, await resolveReference(context, entry)),
        })
    ),
    {
        placeHolder: "Select a setting item.",
        matchOnDescription: true,
    }
);
export const activate = (context: vscode.ExtensionContext) => context.subscriptions.push
(
    vscode.commands.registerCommand
    (
        'blitz.editSettings',
        async () => editSettings(new CommandContext()),
    )
);
export const deactivate = ( ) => { };
