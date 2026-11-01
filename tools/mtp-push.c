// Copies the app to an MTP Kindle in a single session (the Kindle drops off USB after each session).
// Usage: tools/mtp-push <repo root>   — waits up to 3 minutes for the Kindle to appear.
// Sends <root>/brewreader.sh to documents/ and every file in <root>/brewreader/ to documents/brewreader/.
#include <libmtp.h>
#include <dirent.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

static uint32_t find_child_folder(LIBMTP_mtpdevice_t *dev, uint32_t storage, uint32_t parent, const char *name) {
  uint32_t id = 0;
  LIBMTP_file_t *f = LIBMTP_Get_Files_And_Folders(dev, storage, parent);
  while (f) {
    LIBMTP_file_t *next = f->next;
    if (!id && f->filetype == LIBMTP_FILETYPE_FOLDER && strcmp(f->filename, name) == 0) id = f->item_id;
    LIBMTP_destroy_file_t(f);
    f = next;
  }
  return id;
}

// Replaces any existing file of the same name so repeated pushes don't leave duplicates.
static int send_file(LIBMTP_mtpdevice_t *dev, uint32_t storage, uint32_t parent, const char *path, const char *name) {
  struct stat st;
  if (stat(path, &st) != 0) { perror(path); return 1; }

  LIBMTP_file_t *f = LIBMTP_Get_Files_And_Folders(dev, storage, parent);
  while (f) {
    LIBMTP_file_t *next = f->next;
    if (f->filetype != LIBMTP_FILETYPE_FOLDER && strcmp(f->filename, name) == 0) LIBMTP_Delete_Object(dev, f->item_id);
    LIBMTP_destroy_file_t(f);
    f = next;
  }

  LIBMTP_file_t *nf = LIBMTP_new_file_t();
  nf->filename = strdup(name);
  nf->filesize = st.st_size;
  nf->filetype = LIBMTP_FILETYPE_UNKNOWN;
  nf->parent_id = parent;
  nf->storage_id = storage;
  int rc = LIBMTP_Send_File_From_File(dev, path, nf, NULL, NULL);
  printf("%s %s (%lld bytes)\n", rc == 0 ? "sent" : "FAILED", name, (long long)st.st_size);
  if (rc != 0) LIBMTP_Dump_Errorstack(dev);
  LIBMTP_destroy_file_t(nf);
  return rc != 0;
}

int main(int argc, char **argv) {
  if (argc != 2) { fprintf(stderr, "usage: %s <repo root>\n", argv[0]); return 2; }
  const char *root = argv[1];
  char path[4096];

  LIBMTP_Init();
  LIBMTP_mtpdevice_t *dev = NULL;
  for (int i = 0; i < 180 && !dev; i++) {
    // macOS's camera daemon grabs MTP devices as soon as they connect.
    system("killall -9 ptpcamerad 2>/dev/null");
    // Uncached: LIBMTP_Get_Files_And_Folders refuses to work on a cached device.
    LIBMTP_raw_device_t *raw = NULL;
    int count = 0;
    if (LIBMTP_Detect_Raw_Devices(&raw, &count) == LIBMTP_ERROR_NONE && count > 0)
      dev = LIBMTP_Open_Raw_Device_Uncached(&raw[0]);
    free(raw);
    if (!dev) sleep(1);
  }
  if (!dev) { fprintf(stderr, "No Kindle found. Plug it in and unlock it.\n"); return 1; }
  printf("Connected: %s\n", LIBMTP_Get_Friendlyname(dev));

  LIBMTP_Get_Storage(dev, LIBMTP_STORAGE_SORTBY_NOTSORTED);
  if (!dev->storage) { fprintf(stderr, "No storage on device\n"); return 1; }
  uint32_t storage = dev->storage->id;

  uint32_t docs = find_child_folder(dev, storage, LIBMTP_FILES_AND_FOLDERS_ROOT, "documents");
  if (!docs) { fprintf(stderr, "documents/ not found\n"); return 1; }

  uint32_t app = find_child_folder(dev, storage, docs, "brewreader");
  if (!app) app = LIBMTP_Create_Folder(dev, "brewreader", docs, storage);
  if (!app) { fprintf(stderr, "Could not create documents/brewreader\n"); LIBMTP_Dump_Errorstack(dev); return 1; }

  int failures = 0;
  snprintf(path, sizeof path, "%s/brewreader.sh", root);
  failures += send_file(dev, storage, docs, path, "brewreader.sh");

  snprintf(path, sizeof path, "%s/brewreader", root);
  DIR *d = opendir(path);
  if (!d) { perror(path); return 1; }
  struct dirent *e;
  while ((e = readdir(d))) {
    if (e->d_name[0] == '.' || strcmp(e->d_name, "latest.html") == 0) continue;
    char file[4096];
    snprintf(file, sizeof file, "%s/%s", path, e->d_name);
    failures += send_file(dev, storage, app, file, e->d_name);
  }
  closedir(d);

  LIBMTP_Release_Device(dev);
  printf(failures ? "Done with %d failure(s)\n" : "Done\n", failures);
  return failures != 0;
}
