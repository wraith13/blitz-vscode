import * as vscode from 'vscode';
type PrimaryConfigurationType = "null" | "boolean" | "string" | "integer" | "number" | "array" | "object" ;
type ConfigurationType = PrimaryConfigurationType | PrimaryConfigurationType [ ] ;
interface PackageJsonConfigurationProperty
{
    type : ConfigurationType ;
    scope ?: string ;
    default ?: any ;
    items ?: PackageJsonConfiguration ;
    enum ?: string [ ] ;
    minimum ?: number ;
    maximum ?: number ;
    overridable ?: boolean ;
    description ?: string ;
    enumDescriptions ?: string [ ] ;
    markdownDescription ?: string ;
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
    title : string ;
    id : string ;
} ;
const vscodeSettings : SettingsEntry [ ] = [ ] ;
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
export const aggregateSettings = ( ) => vscodeSettings
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
    . reduce ( ( a , b ) => a . concat ( b ) , [ ] ) 
    . concat ( extensionSettings ( ) ) ;
export const getConfiguration = < T >
(
    configurationTarget : vscode . ConfigurationTarget ,
    _overridable : boolean ,
    entry : SettingsEntry
) : T | undefined => vscode.workspace.getConfiguration
(
    makeConfigurationSection ( entry . id ) ,
    getConfigurationScope ( configurationTarget )
)
. get < T >
(
    makeConfigurationKey ( entry . id )
);
export const setConfiguration = async < T >
(
    configurationTarget : vscode . ConfigurationTarget ,
    _overridable : boolean ,
    entry : SettingsEntry ,
    value : T
) => await vscode.workspace.getConfiguration
(
    makeConfigurationSection ( entry . id ) ,
    getConfigurationScope ( configurationTarget )
)
. update
(
    makeConfigurationKey ( entry . id ) ,
    value ,
    configurationTarget
);
export const makeSettingValueItem = < T >
(
    configurationTarget : vscode . ConfigurationTarget ,
    overridable : boolean ,
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
        overridable ,
        entry ,
        value
    )
});
export const makeSettingValueItemListFromList =
(
    configurationTarget : vscode . ConfigurationTarget ,
    overridable : boolean ,
    entry : SettingsEntry
) : CommandMenuItem [ ] =>
{
    const list : { value : any , description : string [ ] , detail ? : string } [ ] = [ ] ;
    const register = ( value : any , description ? : string , detail ? : string ) =>
    {
        const item = list . filter ( i => i . value === value ) [ 0 ] ;
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
                entry ?. enumDescriptions ?. [ index ]
            )
        ) ;
    }
    register ( getDefaultValue ( entry ) , "default" ) ;
    register ( getConfiguration ( configurationTarget , overridable , entry ) , "current" ) ;
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
            overridable ,
            entry ,
            i . value ,
            0 < i . description .length ? i . description . join ( ", " ) : undefined ,
            i . detail
        )
    );
};
export const hasType = ( entry : SettingsEntry , type : PrimaryConfigurationType ) =>
    Array . isArray ( entry . type ) ?
        0 <= ( < PrimaryConfigurationType [ ] > entry . type ) . indexOf ( type ) :
        < PrimaryConfigurationType > entry . type === type ;
export const editSettingValue =
async (
    configurationTarget : vscode . ConfigurationTarget ,
    overridable : boolean ,
    entry : SettingsEntry ,
    validateInput : ( input: string ) => string | undefined | null | Thenable<string | undefined | null>,
    parser : ( input : string ) => unknown
) =>
{
    const input = await vscode.window.showInputBox
    ({
        value: undefinedOrString ( await getConfiguration ( configurationTarget , overridable , entry ) ) ,
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
                overridable ,
                entry ,
                value
            );
        }
    }
};
export const undefinedOrString = ( value : any ) => undefined === value ?
    undefined :
    `${ "object" === typeof value ? JSON . stringify ( value ) : value }`;
export const makeEditSettingValueItemList =
(
    configurationTarget : vscode . ConfigurationTarget ,
    overridable : boolean ,
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
                overridable ,
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
                overridable ,
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
                overridable ,
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
    if ( hasType ( entry , "object" ) )
    {
        result.push
        ({
            label : "$(edit) Input object",
            command : async ( ) => await editSettingValue
            (
                configurationTarget ,
                overridable ,
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
export const editSettingItem = async (
    configurationTarget : vscode . ConfigurationTarget ,
    overridable : boolean ,
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
                    overridable ,
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
                overridable ,
                entry
            ),
            makeSettingValueItemListFromList
            (
                configurationTarget ,
                overridable ,
                entry
            )
        ),
        {
            placeHolder: `${ makeSettingLabel ( entry ) } ( ${ entry . id } ) :`
        }
    )
) ?. command ( ) ;
export const makeSettingLabel = ( entry : SettingsEntry ) =>
{
    const title = `${ entry . title }: `;
    const base = entry . id
        . replace ( /\./mg , ": " )
        . replace ( /([a-z0-9])([A-Z])/g , "$1 $2" )
        . replace ( /(^|\s)([a-z])/g , (_s,m1,m2)=>`${m1}${m2.toUpperCase()}` ) ;
    return base . startsWith ( title ) ? base : `${title}${base}` ;
};
export const getConfigurationScope = ( configurationTarget : vscode . ConfigurationTarget ) =>
{
    switch ( configurationTarget )
    {
    case vscode . ConfigurationTarget . Global :
        return undefined;
    case vscode . ConfigurationTarget . Workspace :
        return vscode.workspace.workspaceFolders ?. [ 0 ] ;
    case vscode . ConfigurationTarget . WorkspaceFolder :
        const activeDocumentUri = vscode . window . activeTextEditor ?. document . uri ;
        return activeDocumentUri ?
            vscode . workspace . getWorkspaceFolder ( activeDocumentUri ) :
            vscode . workspace . workspaceFolders ?. [ 0 ] ;
    }
    return undefined ;
};
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
export const editSettings = async (
    configurationTarget : vscode . ConfigurationTarget ,
    overridable : boolean
) =>
(
    await vscode .window . showQuickPick
    (
        aggregateSettings ( ) . map
        (
            entry =>
            ({
                label : makeSettingLabel ( entry ) ,
                description : makeEditSettingDescription
                (
                    entry,
                    getConfiguration
                    (
                        configurationTarget ,
                        overridable ,
                        entry
                    )
                ),
                detail : entry . description ,
                command : async ( ) => await editSettingItem
                (
                    configurationTarget ,
                    overridable ,
                    entry
                ) ,
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
        'blitz.editUserSettings',
        async ( ) => editSettings
        (
            vscode . ConfigurationTarget . Global ,
            false
        ) ,
    ) ,
    vscode . commands . registerCommand
    (
        'blitz.editWorkspaceSettings',
        async ( ) => editSettings
        (
            vscode . ConfigurationTarget . Workspace ,
            false
        ) ,
    ) ,
    vscode . commands . registerCommand
    (
        'blitz.editFolderSettings',
        async ( ) => editSettings
        (
            vscode . ConfigurationTarget . WorkspaceFolder ,
            false
        ) ,
    ) ,
    vscode . commands . registerCommand
    (
        'blitz.editUserOverrideSettings',
        async ( ) => editSettings
        (
            vscode . ConfigurationTarget . Global ,
            true
        ) ,
    ) ,
    vscode . commands . registerCommand
    (
        'blitz.editWorkspaceOverrideSettings',
        async ( ) => editSettings
        (
            vscode . ConfigurationTarget . Workspace ,
            true
        ) ,
    ) ,
    vscode . commands . registerCommand
    (
        'blitz.editFolderOverrideSettings',
        async ( ) => editSettings
        (
            vscode . ConfigurationTarget . WorkspaceFolder ,
            true
        ) ,
    )
) ;
export const deactivate = ( ) => { } ;
