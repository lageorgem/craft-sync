import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto'
import * as fg from 'fast-glob'

/**
 * Represents a file entry with associated metadata.
 */
export interface FileEntry {
    fileName: string;
    lastUpdated: Date;
    etag: string;
}

/**
 * Represents a file entry with a uniform last updated timestamp.
 */
export interface UniformFileEntry extends Omit<FileEntry, 'lastUpdated'> {
    lastUpdated: string;
}

/**
 * A utility class to watch and manage files within a directory.
 */
export class FileWatcher {
    private folderPath: string;
    private frozen: boolean = false;

    /**
     * Creates a new instance of FileWatcher.
     * @param folderPath - The directory to watch for file changes.
     */
    constructor(folderPath: string) {
        this.folderPath = folderPath;
    }

    /**
     * Starts watching the directory for changes and calls the callback with file entries on changes.
     * @param callback - The function to call with a list of file entries on directory changes.
     */
    public watch(callback: (fileEntries: FileEntry[]) => void) {
        const watcher = chokidar.watch(this.folderPath, {
            persistent: true,
            ignoreInitial: true
        });

        const onDirChange = async () => {
            if (this.frozen) return;
            const files = await this.getFilesInDirectory();
            callback(files);
        };

        onDirChange(); // Initial callback
        watcher.on('all', onDirChange); // watch all directory changes
        setInterval(onDirChange, 60000); // Trigger every minute to force polling of server state
    }

    /**
     * Freezes the watcher to stop listening for changes.
     */
    public freeze() {
        this.frozen = true;
    }

    /**
     * Unfreezes the watcher to resume listening for changes.
     */
    public unfreeze() {
        this.frozen = false;
    }

    /**
     * Retrieves the list of files within a specified directory.
     * @param dir - The directory path. Defaults to the watched folder path.
     * @returns A promise resolving to an array of file entries.
     */
    private async getFilesInDirectory(dir: string = this.folderPath): Promise<FileEntry[]> {
        const files = await fg.async(['**/*'], {
            cwd: dir,
            dot: true,
            onlyFiles: true, // Set this to true if you only want files (not directories)
            absolute: true   // Returns the absolute path to each file
        });

        const fileJobs = files.map(f => this.processFile(f));

        return await Promise.all(fileJobs) as FileEntry[];
    }

    /**
     * Processes a file and retrieves its metadata.
     * @param fullPath - The full path to the file.
     * @returns A promise resolving to the file entry or null if not a file.
     */
    private async processFile(fullPath: string): Promise<FileEntry | null> {
        const stats = await fs.promises.stat(fullPath);

        if (stats.isFile()) {
            const relativePath = path.relative(this.folderPath, fullPath);
            return {
                fileName: relativePath,
                lastUpdated: stats.mtime,
                etag: this.calculateS3ETag(fullPath)
            };
        }

        return null;
    }

    private calculateS3ETag(filePath: string, chunkSize = 5 * 1024 * 1024) {
        const md5Hashes = [];

        const fileDescriptor = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(chunkSize);

        let bytesRead;
        while ((bytesRead = fs.readSync(fileDescriptor, buffer, 0, chunkSize, null)) !== 0) {
            md5Hashes.push(crypto.createHash('md5').update(buffer.slice(0, bytesRead)));
        }

        fs.closeSync(fileDescriptor);

        if (md5Hashes.length < 1) {
            return `"${crypto.createHash('md5').update('').digest('hex')}"`;
        }

        if (md5Hashes.length === 1) {
            return `"${md5Hashes[0].digest('hex')}"`;
        }

        const combinedHashes = Buffer.concat(md5Hashes.map(hash => hash.digest()));
        const combinedHashesMd5 = crypto.createHash('md5').update(combinedHashes);
        return `"${combinedHashesMd5.digest('hex')}-${md5Hashes.length}"`;
    }
}
