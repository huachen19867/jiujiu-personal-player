import { FolderDown, ListMusic } from 'lucide-react';

interface ImportActionsProps {
  notice: string | null;
  onFilesSelected: (files: FileList | File[]) => void;
  onImportDirectory: () => void;
}

export function ImportActions({ notice, onFilesSelected, onImportDirectory }: ImportActionsProps) {
  return (
    <section className="import-panel" aria-label="本地导入">
      <label className="import-button file-import">
        <ListMusic aria-hidden="true" size={20} />
        <span>选歌</span>
        <input
          aria-label="选歌"
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

      <button className="import-button" type="button" onClick={onImportDirectory}>
        <FolderDown aria-hidden="true" size={20} />
        <span>导入文件夹</span>
      </button>

      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
