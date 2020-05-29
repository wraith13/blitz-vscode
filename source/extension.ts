import * as vscode from 'vscode';
type PrimaryConfigurationType = "null" | "string" | "boolean" | "integer" | "number" | "array" | "object" ;
type ConfigurationType = PrimaryConfigurationType | PrimaryConfigurationType [ ] ;
interface PackageJsonConfigurationProperty
{
    type : ConfigurationType ;
    scope : string ;
    default : any ;
    items : PackageJsonConfiguration ;
    enum ?: string [ ] ;
    minimum ?: number ;
    maximum ?: number ;
    overridable ?: boolean ;
    description ?: string ;
}
interface PackageJsonConfiguration
{
    id ?: string;
    order ?: number,
    type ?: ConfigurationType,
    title : string;
    properties : { [ key : string ] : PackageJsonConfigurationProperty }
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
    case "integer" :
    case "number" :
        return 0 ;
    case "string" :
        return "" ;
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
export const aggregateSettings = ( ) => vscodeSettings . concat ( extensionSettings ( ) ) ;
export const getConfiguration =
(
    configurationTarget : vscode . ConfigurationTarget ,
    _overridable : boolean ,
    entry : SettingsEntry
) => vscode.workspace.getConfiguration
(
    makeConfigurationSection ( entry . id ) ,
    getConfigurationScope ( configurationTarget )
)
. get
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
    value : T
) =>
({
    label : JSON . stringify ( value ) ,
    command : async () => await setConfiguration
    (
        configurationTarget ,
        overridable ,
        entry ,
        value
    )
});
export const makeSettingValueItemListFromList = < T >
(
    configurationTarget : vscode . ConfigurationTarget ,
    overridable : boolean ,
    entry : SettingsEntry ,
    valueList : T [ ]
) => valueList . map
(
    value => makeSettingValueItem
    (
        configurationTarget ,
        overridable ,
        entry ,
        value
    )
) ;
export const makeSettingValueItemListForEnum =
(
    configurationTarget : vscode . ConfigurationTarget ,
    overridable : boolean ,
    entry : SettingsEntry
) => makeSettingValueItemListFromList
(
    configurationTarget ,
    overridable ,
    entry ,
    entry . enum ?? [ ]
) ;
export const makeSettingValueItemListForBoolean =
(
    configurationTarget : vscode . ConfigurationTarget ,
    overridable : boolean ,
    entry : SettingsEntry
) => makeSettingValueItemListFromList
(
    configurationTarget ,
    overridable ,
    entry ,
    [ false , true ]
) ;
export const makeSettingValueList =
(
    entry : SettingsEntry
): unknown [ ] =>
{
    const result : unknown [ ] = [ ];
    const types = ( "string" === typeof entry . type ? [ entry . type ]: entry . type  );
    result . push ( getDefaultValue ( entry ) ) ;
    if ( 0 <= types . indexOf ( "null" ) )
    {
        result . push ( null ) ;
    }
    if ( 0 <= types . indexOf ("boolean") )
    {
        result . push ( false ) ;
        result . push ( true ) ;
    }
    if ( entry . enum )
    {
        entry . enum . forEach ( i => result . push ( i ) ) ;
    }
    return result . filter ( ( i , index ) => index === result . indexOf ( i ) ) ;
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
        makeSettingValueItemListFromList
        (
            configurationTarget ,
            overridable ,
            entry ,
            makeSettingValueList(entry)
        ),
        {

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
            i =>
            ({
                label : makeSettingLabel ( i ) ,
                description : makeEditSettingDescription
                (
                    i,
                    getConfiguration
                    (
                        configurationTarget ,
                        overridable ,
                        i
                    )
                ),
                detail : i . description ,
                command : async ( ) => await editSettingItem
                (
                    configurationTarget ,
                    overridable ,
                    i
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
