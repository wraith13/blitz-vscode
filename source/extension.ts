import * as vscode from 'vscode';
interface SettingsEntry
{
	id : string ;
	type : string | string [ ] ;
	default : any ;
	minimum ?: number ;
	maximum ?: number ;
	overridable ?: boolean ;
	description ?: string ;
} ;
const vscodeSettings : SettingsEntry [ ] = [ ];
export const extentionSettings = ( ): SettingsEntry [ ] =>
{

} ;
export const aggregateSettings = ( ): SettingsEntry [ ] => vscodeSettings . concat ( extentionSettings ( ) ) ;
export const editSettingItem = async ( entry : SettingsEntry ) =>
(
	await vscode .window . showQuickPick
	(
		[

		] ,
		{

		}
	)
) ?. command ( ) ;
export const editSettings = async (
	_configurationTarget : vscode . ConfigurationTarget,
	_overridable : boolean
) =>
(
	await vscode .window . showQuickPick
	(
		( await aggregateSettings ( ) ) . map
		(
			i =>
			({
				label : i . id ,
				command : async ( ) => await editSettingItem ( i ),
			})
		) ,
		{

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
