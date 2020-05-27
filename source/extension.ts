import * as vscode from 'vscode';
interface PackageJsonConfigurationProperty
{
    type : string | string [ ] ;
    default : any ;
    minimum ?: number ;
    maximum ?: number ;
    overridable ?: boolean ;
    description ?: string ;
}
interface PackageJsonConfiguration
{
    title : string;
    properties : { [ key : string ] : PackageJsonConfigurationProperty }
}
interface PackageJsonContributes
{
    configuration : PackageJsonConfiguration
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
export const editSettingItem = async ( entry : SettingsEntry ) =>
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
export const editSettings = async (
    _configurationTarget : vscode . ConfigurationTarget,
    _overridable : boolean
) =>
(
    await vscode .window . showQuickPick
    (
        aggregateSettings ( ) . map
        (
            i =>
            ({
                label : makeSettingLabel ( i ) ,
                description : i . id +": "+ JSON.stringify(vscode.workspace.getConfiguration(i.id.replace(/^(.*)(\.)([^.]*)$/, "$1")).get(i.id.replace(/^(.*)(\.)([^.]*)$/, "$3"))),
                detail : JSON.stringify(i.type) + i . description ,
                command : async ( ) => await editSettingItem ( i ) ,
            })
        ) ,
        {
            placeHolder : "Select a setting item." ,
            matchOnDescription : true ,
        }
    )
) ?. command ( ) ;
export const activate = (context : vscode . ExtensionContext) => context . subscriptions . push
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
