import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, Plus, Settings as SettingsIcon, Trash2, Edit2, Image, Download } from 'lucide-react';
import JSZip from 'jszip';
import type { Dashboard } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface DashboardSwitcherProps {
  dashboards: Dashboard[];
  activeDashboard: Dashboard | null;
  onDashboardChange: (dashboard: Dashboard) => void;
  onDashboardsUpdate: () => void;
}

export const DashboardSwitcher = ({
  dashboards,
  activeDashboard,
  onDashboardChange,
  onDashboardsUpdate,
}: DashboardSwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [newDashboardEmoji, setNewDashboardEmoji] = useState('📝');
  const [newDashboardCover, setNewDashboardCover] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [contextMenuDashboard, setContextMenuDashboard] = useState<Dashboard | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);
  const { user } = useAuth();
  const switcherRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editCoverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setContextMenuPosition(null);
        setContextMenuDashboard(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateDashboard = async () => {
    if (!user?.id || !newDashboardName.trim()) return;

    try {
      const { error } = await supabase
        .from('dashboards')
        .insert([{
          user_id: user.id,
          name: newDashboardName.trim(),
          emoji: newDashboardEmoji,
          cover_image: newDashboardCover,
          is_active: false,
        }])
        .select()
        .single();

      if (error) throw error;

      setNewDashboardName('');
      setNewDashboardEmoji('📝');
      setNewDashboardCover(null);
      setIsCreating(false);
      setIsOpen(false);
      onDashboardsUpdate();
    } catch (error) {
      console.error('Error creating dashboard:', error);
    }
  };

  const handleDeleteDashboard = async (dashboardId: string) => {
    try {
      const { error } = await supabase
        .from('dashboards')
        .delete()
        .eq('id', dashboardId);

      if (error) throw error;
      onDashboardsUpdate();
    } catch (error) {
      console.error('Error deleting dashboard:', error);
    }
  };

  const handleExportDashboard = async (dashboard: Dashboard) => {
    try {
      // Fetch all notes and folders for this dashboard
      const { data: notes, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('dashboard_id', dashboard.id);

      const { data: folders, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('dashboard_id', dashboard.id);

      if (notesError || foldersError) throw notesError || foldersError;

      // Create ZIP file
      const zip = new JSZip();
      
      // Build folder structure
      const folderMap = new Map<string, any>();
      (folders || []).forEach(folder => {
        folderMap.set(folder.id, folder);
      });

      // Helper to get folder path
      const getFolderPath = (folderId: string): string => {
        const folder = folderMap.get(folderId);
        if (!folder) return '';
        
        const parentPath = folder.parent_id ? getFolderPath(folder.parent_id) : '';
        const folderName = folder.name.replace(/[^a-z0-9]/gi, '_');
        return parentPath ? `${parentPath}/${folderName}` : folderName;
      };

      // Add notes to ZIP
      (notes || []).forEach(note => {
        // Strip HTML tags from content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.content || '';
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        
        const fileName = `${note.title || 'Untitled'}.txt`.replace(/[^a-z0-9.]/gi, '_');
        
        if (note.folder_id) {
          const folderPath = getFolderPath(note.folder_id);
          zip.file(`${folderPath}/${fileName}`, plainText);
        } else {
          zip.file(fileName, plainText);
        }
      });

      // Add README
      const readme = `# ${dashboard.name}\n\nExported from Flow on ${new Date().toLocaleDateString()}\n\nTotal notes: ${notes?.length || 0}\nTotal folders: ${folders?.length || 0}\n`;
      zip.file('README.txt', readme);

      // Generate and download ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dashboard.name.replace(/[^a-z0-9]/gi, '_')}_export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setContextMenuPosition(null);
      setContextMenuDashboard(null);
    } catch (error) {
      console.error('Error exporting dashboard:', error);
      alert('Failed to export dashboard. Please try again.');
    }
  };


  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `dashboard-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('note-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('note-images')
        .getPublicUrl(filePath);

      setNewDashboardCover(data.publicUrl);
    } catch (error) {
      console.error('Error uploading cover:', error);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleEditCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !contextMenuDashboard) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `dashboard-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('note-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('note-images')
        .getPublicUrl(filePath);

      // Update dashboard
      const { error } = await supabase
        .from('dashboards')
        .update({ cover_image: data.publicUrl })
        .eq('id', contextMenuDashboard.id);

      if (error) throw error;
      
      onDashboardsUpdate();
      setContextMenuPosition(null);
      setContextMenuDashboard(null);
    } catch (error) {
      console.error('Error uploading cover:', error);
    }
  };

  const handleUpdateDashboard = async () => {
    if (!editingDashboard || !editName.trim()) return;

    try {
      const { error } = await supabase
        .from('dashboards')
        .update({
          name: editName.trim(),
          emoji: editEmoji,
        })
        .eq('id', editingDashboard.id);

      if (error) throw error;

      setEditingDashboard(null);
      setContextMenuPosition(null);
      setContextMenuDashboard(null);
      onDashboardsUpdate();
    } catch (error) {
      console.error('Error updating dashboard:', error);
    }
  };

  return (
    <div ref={switcherRef} className="relative">
      <div className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#1a1a1a] transition-colors rounded-lg group">
        {/* Left: chevron + current dashboard */}
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
        >
          <ChevronUp
            className={`w-4 h-4 text-[#888888] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
          {activeDashboard?.cover_image ? (
            <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
              <img 
                src={activeDashboard.cover_image} 
                alt={activeDashboard.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <span className="text-lg flex-shrink-0">{activeDashboard?.emoji || '📝'}</span>
          )}
          <span className="text-sm font-medium text-[#e5e5e5] truncate">
            {activeDashboard?.name || 'My Notes'}
          </span>
        </div>

        {/* Right: settings icon */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new Event('openSettings'));
          }}
          className="p-1.5 rounded hover:bg-[#1f1f1f] text-[#888888] hover:text-[#e5e5e5] transition-colors flex-shrink-0"
          title="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl overflow-hidden z-50"
          >
            <div className="max-h-64 overflow-y-auto scrollbar-hide">
              {dashboards && dashboards.length > 0 ? (
                dashboards.map((dashboard) => (
                  <div 
                    key={dashboard.id} 
                    className="group relative"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenuPosition({ x: e.clientX, y: e.clientY });
                      setContextMenuDashboard(dashboard);
                    }}
                  >
                    <div
                      onClick={() => {
                        onDashboardChange(dashboard);
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-3 hover:bg-[#252525] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {dashboard.cover_image ? (
                          <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                            <img 
                              src={dashboard.cover_image} 
                              alt={dashboard.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <span className="text-lg">{dashboard.emoji}</span>
                        )}
                        <span className="text-sm text-[#e5e5e5] truncate">
                          {dashboard.name}
                        </span>
                        {dashboard.is_active && (
                          <div className="w-2 h-2 bg-[#A0522D] rounded-full" />
                        )}
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDashboard(dashboard.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#3a3a3a] rounded transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-[#ef4444]" />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
              <div className="p-4 text-center text-[#888888] text-sm">
                No dashboards found. Create one below!
              </div>
            )}
            </div>

            <div className="border-t border-[#2a2a2a]">
              {isCreating ? (
                <div className="p-3 space-y-3">
                  {/* Cover Photo Preview */}
                  {newDashboardCover && (
                    <div className="relative w-full h-24 rounded-lg overflow-hidden border border-[#2a2a2a]">
                      <img 
                        src={newDashboardCover} 
                        alt="Cover preview" 
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setNewDashboardCover(null)}
                        className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded p-1 transition-colors"
                        title="Remove cover"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-2xl hover:bg-[#1a1a1a] transition-colors"
                    >
                      {newDashboardEmoji}
                    </button>
                    
                    {/* Cover Photo Upload Button */}
                    <div className="relative">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleCoverUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingCover}
                        className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 hover:bg-[#1a1a1a] transition-colors flex items-center gap-2 disabled:opacity-50"
                        title="Add cover photo"
                      >
                        <Image className="w-4 h-4 text-[#888888]" />
                        {uploadingCover ? (
                          <span className="text-xs text-[#888888]">Uploading...</span>
                        ) : newDashboardCover ? (
                          <span className="text-xs text-[#10b981]">✓</span>
                        ) : (
                          <span className="text-xs text-[#888888]">Cover</span>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newDashboardName}
                      onChange={(e) => setNewDashboardName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateDashboard();
                        } else if (e.key === 'Escape') {
                          setIsCreating(false);
                          setNewDashboardName('');
                        }
                      }}
                      placeholder="Dashboard name"
                      className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 text-sm text-[#e5e5e5] placeholder-[#666666] focus:outline-none focus:border-[#A0522D]"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateDashboard}
                      disabled={!newDashboardName.trim()}
                      className="flex-1 bg-[#A0522D] hover:bg-[#8B4513] disabled:bg-[#2a2a2a] disabled:text-[#666666] text-white text-xs py-1.5 rounded transition-colors"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setNewDashboardName('');
                      }}
                      className="flex-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#e5e5e5] text-xs py-1.5 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center gap-2 p-3 hover:bg-[#252525] transition-colors text-[#888888] hover:text-[#e5e5e5]"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Create New Dashboard</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dashboard Context Menu */}
      <AnimatePresence>
        {contextMenuPosition && contextMenuDashboard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl py-1 z-[100] min-w-[200px]"
            style={{ 
              left: contextMenuPosition.x, 
              top: contextMenuPosition.y 
            }}
          >
            <button
              onClick={() => {
                setEditingDashboard(contextMenuDashboard);
                setEditName(contextMenuDashboard?.name || '');
                setEditEmoji(contextMenuDashboard?.emoji || '📝');
                setContextMenuPosition(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] transition-colors flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit Name & Icon
            </button>
            
            <input
              ref={editCoverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleEditCoverUpload}
            />
            <button
              onClick={() => editCoverInputRef.current?.click()}
              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] transition-colors flex items-center gap-2"
            >
              <Image className="w-4 h-4" />
              Change Cover
            </button>
            
            <div className="border-t border-[#2a2a2a] my-1" />

            <button
              onClick={() => {
                if (contextMenuDashboard) {
                  handleExportDashboard(contextMenuDashboard);
                }
              }}
              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Dashboard
            </button>
            
            <div className="border-t border-[#2a2a2a] my-1" />
            
            <button
              onClick={() => {
                window.dispatchEvent(new Event('openSettings'));
                setContextMenuPosition(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-[#252525] transition-colors flex items-center gap-2"
            >
              <SettingsIcon className="w-4 h-4" />
              Settings
            </button>
            
            <button
              onClick={() => {
                if (contextMenuDashboard && window.confirm(`Delete "${contextMenuDashboard.name}"? This will also delete all notes and folders in this dashboard.`)) {
                  handleDeleteDashboard(contextMenuDashboard.id);
                }
                setContextMenuPosition(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[#ef4444] hover:bg-[#252525] transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Dashboard Modal */}
      <AnimatePresence>
        {editingDashboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
            onClick={() => setEditingDashboard(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 w-80"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-[#e5e5e5] mb-4">Edit Dashboard</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEditEmojiPicker(!showEditEmojiPicker)}
                      className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-2xl hover:bg-[#252525] transition-colors"
                    >
                      {editEmoji}
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-[#e5e5e5] focus:outline-none focus:border-[#A0522D]"
                    placeholder="Dashboard name"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateDashboard}
                    className="flex-1 bg-[#A0522D] hover:bg-[#8B4513] text-white px-4 py-2 rounded transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingDashboard(null)}
                    className="px-4 py-2 text-[#888888] hover:text-[#e5e5e5] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
