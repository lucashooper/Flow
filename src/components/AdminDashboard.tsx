import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';
import { Download, Folder, FileText, HardDrive, TrendingUp, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FolderUsage {
  id: string;
  name: string;
  noteCount: number;
  totalSize: number;
  imageCount: number;
}

export const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [folderUsage, setFolderUsage] = useState<FolderUsage[]>([]);
  const [totalNotes, setTotalNotes] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [estimatedSize, setEstimatedSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Only show for admin email
  const ADMIN_EMAIL = 'edwardsjonny547@gmail.com';
  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) return;
    loadUsageData();
  }, [isAdmin]);

  const loadUsageData = async () => {
    setLoading(true);
    try {
      // Get all notes from IndexedDB
      const notes = await db.notes.toArray();
      const folders = await db.folders.toArray();

      setTotalNotes(notes.length);

      // Analyze each folder
      const folderMap = new Map<string, FolderUsage>();

      folders.forEach(folder => {
        folderMap.set(folder.id, {
          id: folder.id,
          name: folder.name,
          noteCount: 0,
          totalSize: 0,
          imageCount: 0,
        });
      });

      // Add root folder for notes without a folder
      folderMap.set('root', {
        id: 'root',
        name: '(No Folder)',
        noteCount: 0,
        totalSize: 0,
        imageCount: 0,
      });

      let totalImageCount = 0;
      let totalSizeEstimate = 0;

      notes.forEach(note => {
        const folderId = note.folder_id || 'root';
        const folderData = folderMap.get(folderId);
        if (!folderData) return;

        folderData.noteCount++;

        // Estimate size from content length (rough estimate)
        const contentSize = (note.content?.length || 0) * 2; // UTF-16 = 2 bytes per char
        folderData.totalSize += contentSize;
        totalSizeEstimate += contentSize;

        // Count images in content
        const imageMatches = note.content?.match(/<img[^>]+src="[^"]+"/g) || [];
        const imageCount = imageMatches.length;
        folderData.imageCount += imageCount;
        totalImageCount += imageCount;

        // Estimate 500KB per image on average
        const imageSize = imageCount * 500 * 1024;
        folderData.totalSize += imageSize;
        totalSizeEstimate += imageSize;
      });

      setTotalImages(totalImageCount);
      setEstimatedSize(totalSizeEstimate);

      // Sort by size descending
      const sorted = Array.from(folderMap.values())
        .filter(f => f.noteCount > 0)
        .sort((a, b) => b.totalSize - a.totalSize);

      setFolderUsage(sorted);
    } catch (error) {
      console.error('Failed to load usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const exportAllData = async () => {
    setExporting(true);
    try {
      const notes = await db.notes.toArray();
      const folders = await db.folders.toArray();

      const exportData = {
        notes,
        folders,
        exported_at: new Date().toISOString(),
        total_notes: notes.length,
        total_folders: folders.length,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flow-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      alert(`✅ Exported ${notes.length} notes and ${folders.length} folders`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('❌ Export failed: ' + error);
    } finally {
      setExporting(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">Loading usage data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4 p-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg transition-colors hover:bg-[#1a1a1a]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Admin Dashboard
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Data usage and export tools
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-6xl mx-auto">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div
          className="p-6 rounded-lg"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <span className="text-sm" style={{ color: 'var(--muted)' }}>Total Notes</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {totalNotes.toLocaleString()}
          </div>
        </div>

        <div
          className="p-6 rounded-lg"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Folder className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <span className="text-sm" style={{ color: 'var(--muted)' }}>Folders</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {folderUsage.length}
          </div>
        </div>

        <div
          className="p-6 rounded-lg"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5" style={{ color: '#f59e0b' }} />
            <span className="text-sm" style={{ color: 'var(--muted)' }}>Images</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {totalImages.toLocaleString()}
          </div>
        </div>

        <div
          className="p-6 rounded-lg"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <HardDrive className="w-5 h-5" style={{ color: '#ef4444' }} />
            <span className="text-sm" style={{ color: 'var(--muted)' }}>Est. Size</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {formatBytes(estimatedSize)}
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="mb-8">
        <button
          onClick={exportAllData}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          style={{
            background: exporting ? 'var(--bg-elev)' : 'var(--accent)',
            color: exporting ? 'var(--muted)' : '#000',
            cursor: exporting ? 'not-allowed' : 'pointer',
          }}
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'Export All Data (JSON)'}
        </button>
        <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
          Downloads a complete backup of all notes and folders as JSON
        </p>
      </div>

      {/* Folder Usage Table */}
      <div>
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>
          Storage by Folder
        </h2>
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          <table className="w-full">
            <thead style={{ background: 'var(--bg-elev)' }}>
              <tr>
                <th className="text-left p-3 font-medium" style={{ color: 'var(--muted)' }}>
                  Folder
                </th>
                <th className="text-right p-3 font-medium" style={{ color: 'var(--muted)' }}>
                  Notes
                </th>
                <th className="text-right p-3 font-medium" style={{ color: 'var(--muted)' }}>
                  Images
                </th>
                <th className="text-right p-3 font-medium" style={{ color: 'var(--muted)' }}>
                  Est. Size
                </th>
                <th className="text-right p-3 font-medium" style={{ color: 'var(--muted)' }}>
                  % of Total
                </th>
              </tr>
            </thead>
            <tbody>
              {folderUsage.map((folder, index) => (
                <tr
                  key={folder.id}
                  style={{
                    borderTop: index > 0 ? '1px solid var(--border)' : 'none',
                    background: 'var(--bg)',
                  }}
                >
                  <td className="p-3" style={{ color: 'var(--text)' }}>
                    {folder.name}
                  </td>
                  <td className="text-right p-3" style={{ color: 'var(--text)' }}>
                    {folder.noteCount}
                  </td>
                  <td className="text-right p-3" style={{ color: 'var(--text)' }}>
                    {folder.imageCount}
                  </td>
                  <td className="text-right p-3 font-mono text-sm" style={{ color: 'var(--text)' }}>
                    {formatBytes(folder.totalSize)}
                  </td>
                  <td className="text-right p-3" style={{ color: 'var(--muted)' }}>
                    {((folder.totalSize / estimatedSize) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Egress Warning */}
      <div
        className="mt-8 p-4 rounded-lg"
        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444' }}
      >
        <h3 className="font-bold mb-2" style={{ color: '#ef4444' }}>
          ⚠️ High Egress Usage Detected
        </h3>
        <p className="text-sm mb-2" style={{ color: 'var(--text)' }}>
          Supabase Free plan allows 5 GB/month egress. You're currently at 22.35 GB (447%).
        </p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          <strong>Causes:</strong> Images loaded {totalImages.toLocaleString()} times. Each note open refetches all images.
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
          <strong>Solutions:</strong>
        </p>
        <ul className="text-sm list-disc list-inside mt-1" style={{ color: 'var(--muted)' }}>
          <li>Upgrade to Supabase Pro ($25/month, 200 GB egress)</li>
          <li>Delete unused folders with many images</li>
          <li>Enable CDN caching (requires code update)</li>
          <li>Move images to external CDN (Cloudflare R2, etc.)</li>
        </ul>
      </div>
      </div>
    </div>
  );
};
