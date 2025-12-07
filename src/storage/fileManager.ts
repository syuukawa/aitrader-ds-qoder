// src/storage/fileManager.ts
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileManager {
    /**
     * Ensure directory exists for a given file path
     */
    async ensureDirectoryExists(filePath: string): Promise<void> {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
    }

    /**
     * Save file with option to append or overwrite
     */
    async saveFile(filePath: string, content: string, append: boolean = false): Promise<void> {
        try {
            await this.ensureDirectoryExists(filePath);
            if (append) {
                await fs.appendFile(filePath, content);
            } else {
                await fs.writeFile(filePath, content);
            }
            console.log(`文件 ${filePath} 已${append ? '追加' : '保存'}`);
        } catch (error) {
            console.error(`保存文件 ${filePath} 时出错:`, error);
            throw error;
        }
    }

    /**
     * Append content to file with timestamp header
     */
    async appendToFileWithTimestamp(filePath: string, content: string): Promise<void> {
        try {
            const timestamp = new Date().toLocaleString('zh-CN');
            const separator = '\n' + '='.repeat(80) + '\n';
            const header = `${separator}记录时间: ${timestamp}${separator}`;
            const contentWithHeader = `${header}${content}\n`;
            
            await this.saveFile(filePath, contentWithHeader, true);
            console.log(`内容已追加到文件 ${filePath}`);
        } catch (error) {
            console.error(`追加内容到文件 ${filePath} 时出错:`, error);
            throw error;
        }
    }
}