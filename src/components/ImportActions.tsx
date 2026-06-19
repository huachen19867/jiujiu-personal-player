import { FolderDown, ListMusic } from 'lucide-react';

interface ImportActionsProps {
  notice: string | null;
  directoryImportSupported: boolean;
  nativeAudioImportSupported: boolean;
  onFilesSelected: (files: FileList | File[]) => void;
  onNativeAudioImport: () => void;
  onImportDirectory: () => void;
}

export function ImportActions({
  notice,
  directoryImportSupported,
  nativeAudioImportSupported,
  onFilesSelected,
  onNativeAudioImport,
  onImportDirectory,
}: ImportActionsProps) {
  return (
    <section className="import-panel" aria-label="本地导入">
      {nativeAudioImportSupported ? (
        <button className="import-button file-import" type="button" onClick={onNativeAudioImport}>
          <ListMusic aria-hidden="true" size={20} />
          <span>选歌，可多选</span>
        </button>
      ) : (
        <label className="import-button file-import">
          <ListMusic aria-hidden="true" size={20} />
          <span>选歌，可多选</span>
          <input
            aria-label="选歌，可多选"
            type="file"
            accept="audio/*,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus"
            multiple
            onChange={(event) => {
              if (event.currentTarget.files) {
                onFilesSelected(event.currentTarget.files);
                event.currentTarget.value = '';
              }
            }}
          />
        </label>
      )}

      <button
        className="import-button"
        type="button"
        disabled={!directoryImportSupported}
        onClick={onImportDirectory}
      >
        <FolderDown aria-hidden="true" size={20} />
        <span>{directoryImportSupported ? '导入文件夹' : '文件夹导入暂不可用'}</span>
      </button>

      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
