import { ListMusic } from 'lucide-react';

interface ImportActionsProps {
  notice: string | null;
  nativeAudioImportSupported: boolean;
  onFilesSelected: (files: FileList | File[]) => void;
  onNativeAudioImport: () => void;
}

export function ImportActions({
  notice,
  nativeAudioImportSupported,
  onFilesSelected,
  onNativeAudioImport,
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

      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
