#!/usr/bin/env bun

const [command = 'migrate', ...args] = process.argv.slice(2);

process.argv = [process.argv[0] ?? 'bun', command, ...args];

switch (command) {
	case 'migrate':
		await import('./src/migrate/index');
		break;
	case 'export':
		await import('./src/export/index');
		break;
	case 'delete':
		await import('./src/delete/index');
		break;
	case 'clean-logs':
		await import('./src/clean-logs/index');
		break;
	case 'convert-logs':
		await import('./src/convert-logs/index');
		break;
	default:
		// eslint-disable-next-line no-console
		console.error(
			`Unknown command "${command}". Expected one of: migrate, export, delete, clean-logs, convert-logs.`
		);
		process.exit(1);
}

export {};
