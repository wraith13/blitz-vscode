import * as vscode from 'vscode';
type ConfigurationType = "string" | "boolean" | "number" | "array" | "object" | ConfigurationType [ ] ;
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

export const aggregateSettings = ( ) => vscodeSettings . concat ( extensionSettings ( ) ) ;
export const getConfig =
(
    configurationTarget : vscode . ConfigurationTarget ,
    _overridable : boolean ,
    entry : SettingsEntry
) => vscode.workspace.getConfiguration
(
    entry . id . replace ( /^(.*)(\.)([^.]*)$/ , "$1" ) ,
    getConfigurationScope ( configurationTarget )
)
. get
(
    entry . id . replace ( /^(.*)(\.)([^.]*)$/ , "$3" )
);
export const setConfig = async < T >
(
    configurationTarget : vscode . ConfigurationTarget ,
    _overridable : boolean ,
    entry : SettingsEntry ,
    value : T
) => await vscode.workspace.getConfiguration
(
    entry . id . replace ( /^(.*)(\.)([^.]*)$/ , "$1" ) ,
    getConfigurationScope ( configurationTarget )
)
. update
(
    entry . id . replace ( /^(.*)(\.)([^.]*)$/ , "$3" ) ,
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
    label : `value` ,
    command : async () => await setConfig
    (
        configurationTarget ,
        overridable ,
        entry ,
        value
    )
});
export const makeSettingValueItemListForEnum =
(
    configurationTarget : vscode . ConfigurationTarget ,
    overridable : boolean ,
    entry : SettingsEntry
) =>
    entry . enum ?. map
    (
        i => makeSettingValueItem
        (
            configurationTarget ,
            overridable ,
            entry ,
            i
        )
    ) ?? [ ] ;
export const makeSettingValueItemList = ( _entry : SettingsEntry ) =>
{

};
export const editSettingItem = async (
    _configurationTarget : vscode . ConfigurationTarget ,
    _overridable : boolean ,
    entry : SettingsEntry
) =>
await vscode . window . showInformationMessage ( JSON . stringify ( entry ) ) ;
/*
(
    await vscode . window . showQuickPick
    (
        [

        ] ,
        {

        }
    )
) ?. command ( ) ;
*/
export const makeSettingLabel = ( entry : SettingsEntry ) =>
{
    const title = `${ entry . title }: `;
    const base = entry.id
        .replace(/\./mg, ": ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/(^|\s)([a-z])/g, (_s,m1,m2)=>`${m1}${m2.toUpperCase()}`);
    return base.startsWith(title) ? base: `${title}${base}`;
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
        JSON . stringify ( entry . default ) === JSON . stringify ( value ) ?
            "":
            "* "
    )
    + entry . id + ": " + JSON . stringify ( value ) ;
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
                    getConfig
                    (
                        configurationTarget ,
                        overridable ,
                        i
                    )
                ),
                detail : JSON . stringify ( i . type ) + i . description ,
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
