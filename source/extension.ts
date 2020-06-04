import * as vscode from 'vscode';
type PrimaryConfigurationType = "null" | "boolean" | "string" | "integer" | "number" | "array" | "object" ;
type ConfigurationType = PrimaryConfigurationType | PrimaryConfigurationType [ ] ;
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
} ;
interface PackageJsonConfigurationProperty
{
    type : ConfigurationType ;
    scope ?: ConfigurationScope ;
    default ?: any ;
    items ?: PackageJsonConfiguration ;
    enum ?: string [ ] ;
    minimum ?: number ;
    maximum ?: number ;
    overridable ?: boolean ;
    description ?: string ;
    enumDescriptions ?: string [ ] ;
    markdownDescription ?: string ;
    markdownEnumDescriptions ?: string [ ] ;
    tags ?: string [ ] ;
}
interface PackageJsonConfiguration
{
    id ?: string;
    order ?: number,
    type ?: ConfigurationType,
    title : string;
    properties : { [ key : string ] : PackageJsonConfigurationProperty } ;
}
interface PackageJsonContributes
{
    configuration : PackageJsonConfiguration ;
    configurationDefaults : object ;
}
interface PackageJson
{
    name : string ;
    displayName : string ;
    description : string ;
    version : string ;
    contributes : PackageJsonContributes ;
} ;
interface SettingsEntry extends PackageJsonConfigurationProperty
{
    id : string ;
} ;
interface SchemasSettingsDefault
{
    properties : { [ key : string ] : PackageJsonConfigurationProperty } ;
    patternProperties : unknown ;
    additionalProperties : boolean ;
    allowTrailingCommas : boolean ;
    allowComments : boolean ;
} ;
const getVscodeSettings = async () => < SchemasSettingsDefault > JSON . parse
(
    (
        await vscode . workspace . openTextDocument
        (
            vscode . Uri . parse ( "vscode://schemas/settings/default" )
        )
    )
    . getText ( )
) ;
export interface CommandMenuItem extends vscode.QuickPickItem
{
    command : () => Promise < unknown > ;
}
export const getDefaultValue = ( entry : SettingsEntry ) =>
{
    if ( undefined !== entry . default )
    {
        return entry . default;
    }
    switch
    (
        Array . isArray ( entry . type ) ?
            ( < PrimaryConfigurationType [ ] > entry . type ) [ 0 ] :
            < PrimaryConfigurationType > entry . type
    )
    {
    case "boolean" :
        return false ;
    case "string" :
        return "" ;
    case "integer" :
    case "number" :
        return 0 ;
    case "array" :
        return [ ] ;
    case "object" :
        return { } ;
    default:
        return null ;
    }
};
export const markdownToPlaintext = ( markdown : string | undefined ) =>
    undefined === markdown ?
        undefined :
        markdown . replace ( /`#([a-zA-Z_0-9\-\.]+)#`/mg , "`$1`" ) ;
export const extensionSettings = ( ) : SettingsEntry [ ] => vscode . extensions . all
    . map ( i => ( < PackageJson > i ?. packageJSON ) ?. contributes ?. configuration )
    . filter ( i => i ?. properties )
    . map
    (
        i => Object . keys ( i . properties ) . map
        (
            id => Object . assign
            (
                {
                    title : i . title ,
                    id ,
                } ,
                i . properties [ id ]
            )
        )
    )
    . reduce ( ( a , b ) => a . concat ( b ) , [ ] ) ;
export const makeConfigurationSection = ( id : string ) => id . replace ( /^(.*)(\.)([^.]*)$/ , "$1" ) ;
export const makeConfigurationKey = ( id : string ) => id . replace ( /^(.*)(\.)([^.]*)$/ , "$3" ) ;
export const aggregateSettings = async ( ) =>
{
    const vscodeSettings = await getVscodeSettings ( ) ;
    return Object . keys ( vscodeSettings . properties )
        . map
        (
            id => Object . assign
            (
                {
                    id ,
                } ,
                vscodeSettings . properties [ id ]
            )
        ) ;
} ;
export const inspectConfiguration = < T >
(
    configurationTarget : vscode . ConfigurationTarget ,
    overrideInLanguage : boolean ,
    entry : SettingsEntry
) => vscode.workspace.getConfiguration
(
    makeConfigurationSection ( entry . id ) ,
    makeConfigurationScope ( configurationTarget , overrideInLanguage )
)
. inspect < T >
(
    makeConfigurationKey ( entry . id )
);
export const getConfiguration = < T >
(
    configurationTarget : vscode . ConfigurationTarget ,
    overrideInLanguage : boolean ,
    entry : SettingsEntry
) : T | undefined => vscode.workspace.getConfiguration
(
    makeConfigurationSection ( entry . id ) ,
    makeConfigurationScope ( configurationTarget , overrideInLanguage )
)
. get < T >
(
    makeConfigurationKey ( entry . id )
);
export const setConfiguration = async < T >
(
    configurationTarget : vscode . ConfigurationTarget ,
    overrideInLanguage : boolean ,
    entry : SettingsEntry ,
    value : T
) => await vscode.workspace.getConfiguration
(
    makeConfigurationSection ( entry . id ) ,
    makeConfigurationScope ( configurationTarget , overrideInLanguage )
)
. update
(
    makeConfigurationKey ( entry . id ) ,
    value ,
    configurationTarget ,
    overrideInLanguage
);
export const makeSettingValueItem = < T >
(
    configurationTarget : vscode . ConfigurationTarget ,
    overrideInLanguage : boolean ,
    entry : SettingsEntry ,
    value : T,
    description ? : string ,
    detail ? : string
) =>
({
    label : `$(tag) ${ JSON . stringify ( value ) }` ,
    description ,
    detail ,
    command : async () => await setConfiguration
    (
        configurationTarget ,
        overrideInLanguage ,
        entry ,
        value
    )
});
export const makeSettingValueItemList =
(
    configurationTarget : vscode . ConfigurationTarget ,
    overrideInLanguage : boolean ,
    entry : SettingsEntry
) : CommandMenuItem [ ] =>
{
    const list : { value : any , description : string [ ] , detail ? : string } [ ] = [ ] ;
    const register = ( value : any , description ? : string , detail ? : string ) =>
    {
        const item = list . filter ( i => JSON . stringify ( i . value ) === JSON . stringify ( value ) ) [ 0 ] ;
        if (item)
        {
            if ( undefined !== description )
            {
                item . description . push ( description ) ;
            }
            if ( undefined !== detail )
            {
                item . detail = detail ;
            }
        }
        else
        {
            list . push
            ({
                value ,
                description : undefined !== description ? [ description ] : [ ] ,
                detail ,
            }) ;
        }
    } ;
    const types = ( "string" === typeof entry . type ? [ entry . type ]: entry . type  );
    if ( 0 <= types . indexOf ( "null" ) )
    {
        register ( null ) ;
    }
    if ( 0 <= types . indexOf ("boolean") )
    {
        register ( true ) ;
        register ( false ) ;
    }
    if ( undefined !== entry . minimum )
    {
        register ( entry . minimum , "minimum" ) ;
    }
    if ( undefined !== entry . maximum )
    {
        register ( entry . maximum , "maximum" ) ;
    }
    if ( entry . enum )
    {
        entry . enum . forEach
        (
            ( value , index ) => register
            (
                value ,
                undefined ,
                entry ?. enumDescriptions ?. [ index ] ?? markdownToPlaintext ( entry ?. markdownEnumDescriptions ?. [ index ] )
            )
        ) ;
    }
    register ( getDefaultValue ( entry ) , "default" ) ;
    register ( getConfiguration ( configurationTarget , overrideInLanguage , entry ) , "current" ) ;
    const typeIndexOf = ( value : any ) =>
    {
        switch ( typeof value )
        {
        case "boolean" :
            return 1 ;
        case "string" :
            return 2 ;
        case "number" :
            return 3 ;
        case "object" :
            return Array . isArray ( value ) ? 4 : 5 ;
        default :
            return 0;
        }
    };
    list . sort
    (
        ( a , b ) =>
        {
            const aTypeIndex = typeIndexOf ( a . value ) ;
            const bTypeIndex = typeIndexOf ( b . value ) ;
            if ( aTypeIndex < bTypeIndex )
            {
                return -1 ;
            }
            if ( aTypeIndex > bTypeIndex )
            {
                return 1 ;
            }
            if ( entry . enum )
            {
                const aEnumIndex = entry . enum . indexOf ( a . value );
                const bEnumIndex = entry . enum . indexOf ( b . value );
                if ( aEnumIndex < bEnumIndex )
                {
                    return -1 ;
                }
                if ( aEnumIndex > bEnumIndex )
                {
                    return 1 ;
                }
            }
            if ( "number" === typeof a . value && "number" === typeof b . value )
            {
                if ( a < b )
                {
                    return -1 ;
                }
                if ( a > b )
                {
                    return 1 ;
                }
            }
            if ( "string" === typeof a . value && "string" === typeof b . value )
            {
                if ( a < b )
                {
                    return -1 ;
                }
                if ( a > b )
                {
                    return 1 ;
                }
            }
            if ( "object" === typeof a . value && "object" === typeof b . value )
            {
                const aJson = JSON . stringify ( a . value );
                const bJson = JSON . stringify ( b . value );
                if ( aJson < bJson )
                {
                    return -1 ;
                }
                if ( aJson > bJson )
                {
                    return 1 ;
                }
            }
            return 0 ;
        }
    ) ;
    return list . map
    (
        i => makeSettingValueItem
        (
            configurationTarget ,
            overrideInLanguage ,
            entry ,
            i . value ,
            0 < i . description .length ? i . description . join ( ", " ) : undefined ,
            i . detail
        )
    );
};
export const hasType = ( entry : SettingsEntry | PackageJsonConfiguration , type : PrimaryConfigurationType ) =>
    Array . isArray ( entry . type ) ?
        0 <= ( < PrimaryConfigurationType [ ] > entry . type ) . indexOf ( type ) :
        < PrimaryConfigurationType > entry . type === type ;
export const editSettingValue =
async (
    configurationTarget : vscode . ConfigurationTarget ,
    overrideInLanguage : boolean ,
    entry : SettingsEntry ,
    validateInput : ( input: string ) => string | undefined | null | Thenable<string | undefined | null>,
    parser : ( input : string ) => unknown
) =>
{
    const input = await vscode.window.showInputBox
    ({
        value: undefinedOrString
        (
            await getConfiguration
            (
                configurationTarget ,
                overrideInLanguage ,
                entry
            )
        ) ,
        validateInput
    });
    if (undefined !== input)
    {
        const value = parser ( input ) ;
        if (undefined !== value)
        {
            await setConfiguration
            (
                configurationTarget ,
                overrideInLanguage ,
                entry ,
                value
            );
        }
    }
};
export const undefinedOrString = ( value : any ) => undefined === value ?
    undefined :
    JSON . stringify ( value );
export const forceString = ( value : any ) => undefined === value ?
    "undefined" :
    JSON . stringify ( value );
export const makeEditSettingValueItemList =
(
    configurationTarget : vscode . ConfigurationTarget ,
    overrideInLanguage : boolean ,
    entry : SettingsEntry
) : CommandMenuItem [ ] =>
{
    const result : CommandMenuItem [ ] = [ ];
    if ( undefined === entry . enum && hasType ( entry , "string" ) )
    {
        result.push
        ({
            label : "$(edit) Input string",
            command : async ( ) => await editSettingValue
            (
                configurationTarget ,
                overrideInLanguage ,
                entry ,
                ( ) => undefined,
                input => input
            )
        });
    }
    if ( hasType ( entry , "integer" ) )
    {
        result.push
        ({
            label : "$(edit) Input integer",
            command : async ( ) => await editSettingValue
            (
                configurationTarget ,
                overrideInLanguage ,
                entry ,
                input =>
                {
                    const value = parseInt ( input );
                    if ( isNaN ( value ) || value !== parseFloat ( input ) )
                    {
                        return "invalid integer";
                    }
                    if ( undefined !== entry . minimum && value < entry . minimum )
                    {
                        return `minimum: ${ entry . minimum}` ;
                    }
                    if ( undefined !== entry . maximum && entry . maximum < value )
                    {
                        return `maximum: ${ entry . maximum}` ;
                    }
                    return undefined ;
                },
                input => parseInt ( input )
            )
        });
    }
    if ( hasType ( entry , "number" ) )
    {
        result.push
        ({
            label : "$(edit) Input number",
            command : async ( ) => await editSettingValue
            (
                configurationTarget ,
                overrideInLanguage ,
                entry ,
                input =>
                {
                    const value = parseFloat ( input );
                    if ( isNaN ( value ) )
                    {
                        return "invalid number" ;
                    }
                    if ( undefined !== entry . minimum && value < entry . minimum )
                    {
                        return `minimum: ${ entry . minimum}` ;
                    }
                    if ( undefined !== entry . maximum && entry . maximum < value )
                    {
                        return `maximum: ${ entry . maximum}` ;
                    }
                    return undefined ;
                },
                input => parseFloat ( input )
            )
        });
    }
    if ( hasType ( entry , "array" ) )
    {
        result.push
        ({
            label : "$(edit) Input array",
            command : async ( ) => await editSettingValue
            (
                configurationTarget ,
                overrideInLanguage ,
                entry ,
                input =>
                {
                    try
                    {
                        const value = JSON . parse ( input ) ;
                        if ( "object" !== typeof value )
                        {
                            return "invalid array" ;
                        }
                        if ( ! Array . isArray ( value ) )
                        {
                            return "invalid array" ;
                        }
                    }
                    catch
                    {
                        return "invalid array" ;
                    }
                    return undefined ;
                },
                input => JSON . parse ( input )
            )
        });
    }
    if ( hasType ( entry , "object" ) )
    {
        result.push
        ({
            label : "$(edit) Input object",
            command : async ( ) => await editSettingValue
            (
                configurationTarget ,
                overrideInLanguage ,
                entry ,
                input =>
                {
                    try
                    {
                        const value = JSON . parse ( input ) ;
                        if ( "object" !== typeof value )
                        {
                            return "invalid object" ;
                        }
                        if ( Array . isArray ( value ) )
                        {
                            return "invalid object" ;
                        }
                    }
                    catch
                    {
                        return "invalid object" ;
                    }
                    return undefined ;
                },
                input => JSON . parse ( input )
            )
        });
    }
    return result ;
};
export const makeSettingValueEditArrayItemList =
(
    configurationTarget : vscode . ConfigurationTarget ,
    overrideInLanguage : boolean ,
    entry : SettingsEntry
) : CommandMenuItem [ ] =>
{
    const result : CommandMenuItem [ ] = [ ];
    if ( hasType ( entry , "array" ) )
    {
        const array = getConfiguration < any [ ] >
        (
            configurationTarget ,
            overrideInLanguage ,
            entry
        ) ?? [ ] ;
        if ( Array . isArray ( array ) )
        {
            if ( entry . items ?. type && hasType ( entry . items , "null" ) )
            {
                result . push
                ({
                    label: `$(add) Add null item`,
                    command: async () =>
                    {
                        array . push ( null ) ;
                        await setConfiguration
                        (
                            configurationTarget ,
                            overrideInLanguage ,
                            entry ,
                            array
                        );
                    }
                });
            }
            if ( ! entry . items ?. type || hasType ( entry . items , "string" ) )
            {
                result . push
                ({
                    label: `$(add) Add string item`,
                    command: async () =>
                    {
                        const input = await vscode.window.showInputBox ({ }) ;
                        if (undefined !== input)
                        {
                            array . push ( input ) ;
                            await setConfiguration
                            (
                                configurationTarget ,
                                overrideInLanguage ,
                                entry ,
                                array
                            );
                        }
                    }
                });
            }
            array . forEach
            (
                ( item , index ) => result . push
                ({
                    label: `$(remove) Remove "${ undefinedOrString ( item ) }"`,
                    command: async () =>
                    {
                        await setConfiguration
                        (
                            configurationTarget ,
                            overrideInLanguage ,
                            entry ,
                            array . splice ( index , 1 )
                        );
                    }
                })
            );
        }
    }
    return result ;
};

export const selectContext = async ( entry : SettingsEntry ) =>
{
    const contextMenuItemList : CommandMenuItem [ ] = [ ] ;
    const languageId = getLanguageId ( ) ;
    const values = inspectConfiguration ( vscode . ConfigurationTarget . WorkspaceFolder , true , entry ) ;
    const workspaceOverridable = 0 < ( vscode . workspace . workspaceFolders ?.length ?? 0 )  && ( undefined === entry . scope || ( ConfigurationScope . APPLICATION !== entry . scope && ConfigurationScope . MACHINE !== entry . scope ) )
    const workspaceFolderOverridable = 1 < ( vscode . workspace . workspaceFolders ?.length ?? 0 ) && ( undefined === entry . scope || ( ConfigurationScope . APPLICATION !== entry . scope && ConfigurationScope . MACHINE !== entry . scope && ConfigurationScope . WINDOW !== entry . scope ) )
    const languageOverridable = languageId && ( entry . overridable || undefined === entry . scope || ConfigurationScope . LANGUAGE_OVERRIDABLE === entry . scope )
    if ( workspaceOverridable || workspaceFolderOverridable || languageOverridable )
    {
        contextMenuItemList . push
        ({
            label : `Global: ${ forceString ( undefined !== ( values ?. globalValue ) ? values ?. globalValue : values ?. defaultValue ) }` ,
            command : async ( ) => await editSettingItem
            (
                vscode . ConfigurationTarget . Global ,
                false ,
                entry
            )
        }) ;
        if ( workspaceOverridable )
        {
            contextMenuItemList . push
            ({
                label : `WorkspaceFolder: ${ forceString ( values ?. workspaceValue ) }` ,
                command : async ( ) => await editSettingItem
                (
                    vscode . ConfigurationTarget . Workspace ,
                    false ,
                    entry
                )
            }) ;
        }
        if ( workspaceFolderOverridable )
        {
            contextMenuItemList . push
            ({
                label : `WorkspaceFolder: ${ forceString ( values ?. workspaceFolderValue ) }` ,
                command : async ( ) => await editSettingItem
                (
                    vscode . ConfigurationTarget . WorkspaceFolder ,
                    false ,
                    entry
                )
            }) ;
        }
        if ( languageOverridable )
        {
            contextMenuItemList . push
            ({
                label : `Global(lang:${languageId}): ${ forceString ( undefined !== ( values ?. globalLanguageValue ) ? values ?. globalLanguageValue : values ?. defaultLanguageValue ) }` ,
                command : async ( ) => await editSettingItem
                (
                    vscode . ConfigurationTarget . Global ,
                    true ,
                    entry
                )
            }) ;
            if ( workspaceOverridable )
            {
                contextMenuItemList . push
                ({
                    label : `WorkspaceFolder(lang:${languageId}): ${ forceString ( values ?. workspaceLanguageValue ) }` ,
                    command : async ( ) => await editSettingItem
                    (
                        vscode . ConfigurationTarget . Workspace ,
                        true ,
                        entry
                    )
                }) ;
            }
            if ( workspaceFolderOverridable )
            {
                contextMenuItemList . push
                ({
                    label : `WorkspaceFolder(lang:${languageId}): ${ forceString ( values ?. workspaceFolderLanguageValue ) }` ,
                    command : async ( ) => await editSettingItem
                    (
                        vscode . ConfigurationTarget . WorkspaceFolder ,
                        true ,
                        entry
                    )
                }) ;
            }
    }
    }
    if ( 0 < contextMenuItemList . length )
    {
        (
            await vscode .window . showQuickPick
            (
                contextMenuItemList ,
                {
                    placeHolder : "Select a setting context." ,
                    matchOnDescription : true ,
                }
            )
        ) ?. command ( ) ;
    }
    else
    {
        await editSettingItem
        (
            vscode . ConfigurationTarget .Global ,
            false ,
            entry
        ) ;
    }
};
export const editSettingItem = async (
    configurationTarget : vscode . ConfigurationTarget ,
    overrideInLanguage : boolean ,
    entry : SettingsEntry
) =>
//await vscode . window . showInformationMessage ( JSON . stringify ( entry ) ) ;
(
    await vscode . window . showQuickPick
    (
        [
            <CommandMenuItem>
            {
                label : "$(discard) Reset",
                command : async ( ) => await setConfiguration
                (
                    configurationTarget ,
                    overrideInLanguage ,
                    entry ,
                    undefined
                )
            }
        ]
        .concat
        (
            makeEditSettingValueItemList
            (
                configurationTarget ,
                overrideInLanguage ,
                entry
            ),
            makeSettingValueItemList
            (
                configurationTarget ,
                overrideInLanguage ,
                entry
            ),
            makeSettingValueEditArrayItemList
            (
                configurationTarget ,
                overrideInLanguage ,
                entry
            )
        ),
        {
            placeHolder: `${ makeSettingLabel ( entry ) } ( ${ entry . id } ) :`
        }
    )
) ?. command ( ) ;
export const makeSettingLabel = ( entry : SettingsEntry ) =>　entry . id
    . replace ( /\./mg , ": " )
    . replace ( /([a-z0-9])([A-Z])/g , "$1 $2" )
    . replace ( /(^|\s)([a-z])/g , ( _s , m1 , m2 ) =>　`${ m1 }${ m2 . toUpperCase ( ) }` ) ;
export const makeConfigurationScope =
(
    configurationTarget : vscode . ConfigurationTarget ,
    overrideInLanguage : boolean ,
) =>
{
    const activeDocumentUri = vscode . window . activeTextEditor ?. document . uri ;
    if ( activeDocumentUri && overrideInLanguage )
    {
        return activeDocumentUri ;
    }
    switch ( configurationTarget )
    {
    case vscode . ConfigurationTarget . Global :
        return undefined;
    case vscode . ConfigurationTarget . Workspace :
        return vscode . workspace .workspaceFile ??
            vscode . workspace . workspaceFolders ?. [ 0 ] ;
    case vscode . ConfigurationTarget . WorkspaceFolder :
        return activeDocumentUri ?
            vscode . workspace . getWorkspaceFolder ( activeDocumentUri ) :
            vscode . workspace . workspaceFolders ?. [ 0 ] ;
    }
    return undefined ;
};
export const getLanguageId = ( ) => vscode . window . activeTextEditor ?. document . languageId ;
export const makeEditSettingDescription = ( entry : SettingsEntry, value : any ) =>
    (
        JSON . stringify ( getDefaultValue ( entry ) ) === JSON . stringify ( value ) ?
            "":
            "* "
    )
    + entry . id
    + ": "
    + ( "string" === typeof entry . type ? entry . type : JSON . stringify ( entry . type ) )
    + " = "
    + JSON . stringify ( value ) ;
export const editSettings = async ( ) =>
(
    await vscode .window . showQuickPick
    (
        ( await aggregateSettings ( ) ) . map
        (
            entry =>
            ({
                label : makeSettingLabel ( entry ) ,
                description : makeEditSettingDescription
                (
                    entry,
                    getConfiguration
                    (
                        vscode.ConfigurationTarget.WorkspaceFolder ,
                        true ,
                        entry
                    )
                ),
                detail : entry . description ?? markdownToPlaintext ( entry . markdownDescription ) ,
                command : async ( ) => await selectContext ( entry ) ,
            })
        ) ,
        {
            placeHolder : "Select a setting item." ,
            matchOnDescription : true ,
        }
    )
) ?. command ( ) ;
export const activate = ( context : vscode . ExtensionContext ) => context . subscriptions . push
(
    vscode . commands . registerCommand
    (
        'blitz.editSettings',
        async ( ) => editSettings ( ) ,
    )
) ;
export const deactivate = ( ) => { } ;
