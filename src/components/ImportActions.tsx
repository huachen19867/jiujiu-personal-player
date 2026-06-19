import { ListMusic } from 'lucide-react';

interface ImportActionsProps {
  notice: string | null;
  targetPlaylistName: string;
  nativeAudioImportSupported: boolean;
  onFilesSelected: (files: FileList | File[]) => void;
  onNativeAudioImport: () => void;
}

export function ImportActions({
  notice,
  targetPlaylistName,
  nativeAudioImportSupported,
  onFilesSelected,
  onNativeAudioImport,
}: ImportActionsProps) {
  const label = `添加到：${targetPlaylistName}`;

  return (
    <section className="import-panel" aria-label="本地导入">
      {nativeAudioImportSupported ? (
        <button className="import-button file-import" type="button" onClick={onNativeAudioImport}>
          <ListMusic aria-hidden="true" size={20} />
          <span className="import-target">{label}</span>
          <span className="import-caption">选歌，可多选</span>
        </button>
      ) : (
        <label className="import-button file-import">
          <ListMusic aria-hidden="true" size={20} />
          <span className="import-target">{label}</span>
          <span className="import-caption">选歌，可多选</span>
          <input
            aria-label={`${label}，选歌，可多选`}
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
