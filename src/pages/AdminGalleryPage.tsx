import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Image, Plus, Save, Trash2, Upload } from "lucide-react";
import { AdminShell } from "../components/AdminShell";
import { galleryPhotoFormSchema, type GalleryPhotoFormValues } from "../lib/admin";
import {
  deleteGalleryPhoto,
  listAdminGalleryPhotos,
  saveGalleryPhoto,
  updateGalleryPhotoOrder,
  uploadGalleryPhoto
} from "../lib/data";
import { useLanguage } from "../lib/use-language";
import { getLocalizedGalleryPhotoText } from "../lib/localization";
import type { GalleryPhoto } from "../lib/types";

type GalleryFormState = {
  altTextEn: string;
  altTextZh: string;
  isActive: boolean;
};

const blankGalleryForm: GalleryFormState = {
  altTextEn: "",
  altTextZh: "",
  isActive: true
};

export function AdminGalleryPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<GalleryFormState>(blankGalleryForm);
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [formError, setFormError] = useState("");

  const galleryQuery = useQuery({
    queryKey: ["admin-gallery-photos"],
    queryFn: listAdminGalleryPhotos
  });

  const photos = useMemo(() => galleryQuery.data ?? [], [galleryQuery.data]);
  const selectedPhoto = photos.find((photo) => photo.id === selectedId);
  const activeCount = photos.filter((photo) => photo.isActive).length;

  useEffect(() => {
    if (!selectedPhoto) {
      setForm(blankGalleryForm);
      return;
    }

    setForm({
      altTextEn: selectedPhoto.altTextEn ?? selectedPhoto.altText,
      altTextZh: selectedPhoto.altTextZh ?? "",
      isActive: selectedPhoto.isActive
    });
  }, [selectedPhoto]);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl("");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setFilePreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [file]);

  const refreshGallery = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-gallery-photos"] }),
      queryClient.invalidateQueries({ queryKey: ["public-gallery-photos"] })
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async ({ values, selected }: { values: GalleryPhotoFormValues; selected?: GalleryPhoto }) => {
      if (selected) return saveGalleryPhoto(values, selected.id);
      if (!file) throw new Error(t("admin.gallery.fileRequired"));
      return uploadGalleryPhoto(file, values);
    },
    onSuccess: async (savedPhoto) => {
      setSelectedId(savedPhoto.id);
      setFile(null);
      setFormError("");
      await refreshGallery();
    }
  });

  const reorderMutation = useMutation({
    mutationFn: updateGalleryPhotoOrder,
    onSuccess: refreshGallery
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGalleryPhoto,
    onSuccess: async () => {
      setSelectedId("");
      setFile(null);
      setForm(blankGalleryForm);
      await refreshGallery();
    }
  });

  const handleNewPhoto = () => {
    setSelectedId("");
    setFile(null);
    setForm(blankGalleryForm);
    setFormError("");
  };

  const handleSave = () => {
    const parsed = galleryPhotoFormSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? t("admin.gallery.checkFields"));
      return;
    }

    saveMutation.mutate({ values: parsed.data, selected: selectedPhoto });
  };

  const movePhoto = (photo: GalleryPhoto, direction: -1 | 1) => {
    const currentIndex = photos.findIndex((item) => item.id === photo.id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= photos.length) return;

    const nextIds = photos.map((item) => item.id);
    const [movedId] = nextIds.splice(currentIndex, 1);
    nextIds.splice(nextIndex, 0, movedId);
    reorderMutation.mutate(nextIds);
  };

  const previewImageUrl = filePreviewUrl || selectedPhoto?.imageUrl;
  const previewAlt = filePreviewUrl
    ? t("admin.gallery.previewAlt")
    : selectedPhoto
      ? getLocalizedGalleryPhotoText(selectedPhoto, language).altText
      : "";

  return (
    <AdminShell title={t("admin.gallery.title")}>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Metric label={t("admin.gallery.total")} value={String(photos.length)} icon={<Image size={18} />} />
        <Metric label={t("admin.gallery.visible")} value={String(activeCount)} icon={<Upload size={18} />} />
        <Metric label={t("admin.gallery.hidden")} value={String(photos.length - activeCount)} icon={<Trash2 size={18} />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
        <section className="ui-surface-compact">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">{t("admin.gallery.listTitle")}</h2>
              <p className="mt-1 text-sm text-wave-ink/60">{t("admin.gallery.listCopy")}</p>
            </div>
            <button
              type="button"
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-4 py-2 text-sm font-semibold text-white"
              onClick={handleNewPhoto}
              aria-label={t("admin.gallery.newPhoto")}
            >
              <Plus size={17} />
              <span>{t("admin.gallery.newPhoto")}</span>
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-wave-deep/10">
            {galleryQuery.isLoading && <p className="p-4">{t("admin.gallery.loading")}</p>}
            {photos.map((photo, index) => {
              const photoText = getLocalizedGalleryPhotoText(photo, language);

              return (
                <article
                  key={photo.id}
                  className={`grid grid-cols-[84px_minmax(0,1fr)_auto] gap-3 border-t border-wave-deep/10 p-3 transition first:border-t-0 ${
                    selectedId === photo.id
                      ? "bg-wave-mint/60"
                      : "bg-white hover:bg-wave-mint/35"
                  }`}
                >
                  <button
                    type="button"
                    className="focus-ring overflow-hidden rounded-2xl bg-wave-mint"
                    onClick={() => {
                      setSelectedId(photo.id);
                      setFile(null);
                      setFormError("");
                    }}
                  >
                    <img src={photo.imageUrl} alt="" className="h-20 w-20 object-cover" />
                  </button>
                  <button
                    type="button"
                    className="focus-ring min-w-0 text-left"
                    onClick={() => {
                      setSelectedId(photo.id);
                      setFile(null);
                      setFormError("");
                    }}
                  >
                    <span className="block truncate font-bold">{photoText.altText}</span>
                    <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-wave-ink/65">
                      <span
                        className={`ui-status-dot ${
                          photo.isActive ? "bg-emerald-500" : "bg-wave-ink/35"
                        }`}
                        aria-hidden="true"
                      />
                      {photo.isActive ? t("common.active") : t("common.hidden")}
                    </span>
                  </button>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <button
                      type="button"
                      aria-label={t("admin.gallery.moveUp")}
                      disabled={index === 0 || reorderMutation.isPending}
                      onClick={() => movePhoto(photo, -1)}
                      className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full text-wave-ink/60 hover:bg-white disabled:opacity-35"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={t("admin.gallery.moveDown")}
                      disabled={index === photos.length - 1 || reorderMutation.isPending}
                      onClick={() => movePhoto(photo, 1)}
                      className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full text-wave-ink/60 hover:bg-white disabled:opacity-35"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
            {!galleryQuery.isLoading && photos.length === 0 && (
              <p className="ui-subtle-note">
                {t("admin.gallery.empty")}
              </p>
            )}
          </div>
        </section>

        <section className="ui-surface">
          <div className="border-b border-wave-deep/10 pb-5">
            <div>
              <h2 className="text-xl font-black">
                {selectedPhoto ? t("admin.gallery.edit") : t("admin.gallery.new")}
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-6">
            <div>
              <p className="mb-2 block text-sm font-semibold">{t("admin.gallery.file")}</p>
              <input
                id="gallery-photo-file-input"
                aria-label={t("admin.gallery.file")}
                className="sr-only"
                type="file"
                accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                disabled={Boolean(selectedPhoto)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="gallery-photo-file-input"
                  aria-disabled={Boolean(selectedPhoto)}
                  className={`focus-ring inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selectedPhoto
                      ? "pointer-events-none bg-wave-mint text-wave-ink/45"
                      : "bg-wave-deep text-white hover:bg-wave-ink"
                  }`}
                >
                  <Upload size={17} />
                  {t("admin.gallery.choosePhoto")}
                </label>
                <span className="min-w-0 truncate text-sm text-wave-ink/65">
                  {file ? file.name : t("admin.gallery.noFileSelected")}
                </span>
              </div>
            </div>

            {previewImageUrl && (
              <div className="overflow-hidden rounded-2xl bg-wave-mint">
                <img
                  src={previewImageUrl}
                  alt={previewAlt}
                  className="aspect-[16/9] w-full object-cover"
                />
              </div>
            )}

            <div className="ui-section-divider grid gap-6 lg:grid-cols-2 lg:divide-x lg:divide-wave-deep/10">
              <section>
                <h3 className="text-sm font-black text-wave-ink/65">{t("admin.gallery.altTextEn")}</h3>
                <input
                  aria-label={t("admin.gallery.altTextEn")}
                  className="ui-field mt-4"
                  value={form.altTextEn}
                  onChange={(event) => setForm({ ...form, altTextEn: event.target.value })}
                  placeholder={t("admin.gallery.altTextEnPlaceholder")}
                />
              </section>

              <section className="lg:pl-6">
                <h3 className="text-sm font-black text-wave-ink/65">{t("admin.gallery.altTextZh")}</h3>
                <input
                  aria-label={t("admin.gallery.altTextZh")}
                  className="ui-field mt-4"
                  value={form.altTextZh}
                  onChange={(event) => setForm({ ...form, altTextZh: event.target.value })}
                  placeholder={t("admin.gallery.altTextZhPlaceholder")}
                />
              </section>
            </div>

            <label className="ui-section-divider flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block font-semibold">{t("admin.gallery.activePublicly")}</span>
                <span className="text-sm text-wave-ink/60">{t("admin.gallery.visibleHome")}</span>
              </span>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                className="peer sr-only"
              />
              <span className="ui-switch" />
            </label>
          </div>

          {formError && <p className="mt-4 rounded-2xl bg-wave-deep/10 p-3 text-sm text-wave-deep">{formError}</p>}
          {saveMutation.error && (
            <p className="mt-4 rounded-2xl bg-wave-deep/10 p-3 text-sm text-wave-deep">
              {saveMutation.error.message}
            </p>
          )}
          {deleteMutation.error && (
            <p className="mt-4 rounded-2xl bg-wave-deep/10 p-3 text-sm text-wave-deep">
              {deleteMutation.error.message}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-5 py-3 font-semibold text-white disabled:opacity-45"
            >
              <Save size={18} />
              {saveMutation.isPending ? t("common.saving") : t("admin.gallery.save")}
            </button>
            {selectedPhoto && (
              <button
                type="button"
                onClick={() => deleteMutation.mutate(selectedPhoto)}
                disabled={deleteMutation.isPending}
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-wave-deep/15 bg-white px-5 py-3 font-semibold text-wave-ink disabled:opacity-45"
              >
                <Trash2 size={18} />
                {t("admin.gallery.delete")}
              </button>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="ui-surface-compact flex items-center justify-between gap-3 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{label}</p>
        <p className="mt-2 text-2xl font-black">{value}</p>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-wave-mint text-wave-deep">
        {icon}
      </span>
    </div>
  );
}

