return {
  active: editor.getActiveBufferId(),
  buffers: editor.listBuffers().map(buffer => ({ id: buffer.id, path: buffer.path })),
  plugins: (await editor.listPlugins()).filter(plugin => plugin.name.includes('markdown')),
};
