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

  return (
    <AdminShell title={t("admin.gallery.title")}>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Metric label={t("admin.gallery.total")} value={String(photos.length)} icon={<Image size={18} />} />
        <Metric label={t("admin.gallery.visible")} value={String(activeCount)} icon={<Upload size={18} />} />
        <Metric label={t("admin.gallery.hidden")} value={String(photos.length - activeCount)} icon={<Trash2 size={18} />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-wave-deep/10 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">{t("admin.gallery.listTitle")}</h2>
              <p className="mt-1 text-sm text-wave-ink/60">{t("admin.gallery.listCopy")}</p>
            </div>
            <button
              type="button"
              className="focus-ring rounded-full bg-wave-mint p-2 text-wave-deep"
              onClick={handleNewPhoto}
              aria-label={t("admin.gallery.newPhoto")}
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {galleryQuery.isLoading && <p>{t("admin.gallery.loading")}</p>}
            {photos.map((photo, index) => {
              const photoText = getLocalizedGalleryPhotoText(photo, language);

              return (
                <article
                  key={photo.id}
                  className={`grid grid-cols-[84px_minmax(0,1fr)_auto] gap-3 rounded-2xl border p-3 transition ${
                    selectedId === photo.id
                      ? "border-wave-deep bg-wave-mint"
                      : "border-wave-deep/10 bg-white"
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
                    <span className="mt-2 inline-flex rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-wave-deep">
                      {photo.isActive ? t("common.active") : t("common.hidden")}
                    </span>
                  </button>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      aria-label={t("admin.gallery.moveUp")}
                      disabled={index === 0 || reorderMutation.isPending}
                      onClick={() => movePhoto(photo, -1)}
                      className="focus-ring rounded-full border border-wave-deep/10 bg-white p-2 disabled:opacity-35"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={t("admin.gallery.moveDown")}
                      disabled={index === photos.length - 1 || reorderMutation.isPending}
                      onClick={() => movePhoto(photo, 1)}
                      className="focus-ring rounded-full border border-wave-deep/10 bg-white p-2 disabled:opacity-35"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
            {!galleryQuery.isLoading && photos.length === 0 && (
              <p className="rounded-2xl bg-wave-mint/70 p-4 text-sm text-wave-ink/70">
                {t("admin.gallery.empty")}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-wave-deep/10 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-wave-mint text-wave-deep">
              <Image size={21} />
            </span>
            <div>
              <h2 className="text-xl font-black">
                {selectedPhoto ? t("admin.gallery.edit") : t("admin.gallery.new")}
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <Field label={t("admin.gallery.file")}>
              <input
                aria-label={t("admin.gallery.file")}
                className="focus-ring w-full rounded-2xl border border-wave-deep/15 px-3 py-3"
                type="file"
                accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                disabled={Boolean(selectedPhoto)}
              />
              {file && <p className="mt-2 text-sm text-wave-ink/60">{file.name}</p>}
            </Field>

            {selectedPhoto && (
              <div className="overflow-hidden rounded-3xl border border-wave-deep/10 bg-wave-mint">
                <img
                  src={selectedPhoto.imageUrl}
                  alt={getLocalizedGalleryPhotoText(selectedPhoto, language).altText}
                  className="aspect-[16/9] w-full object-cover"
                />
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-wave-deep/10 p-4">
                <h3 className="font-black">{t("admin.gallery.altTextEn")}</h3>
                <input
                  aria-label={t("admin.gallery.altTextEn")}
                  className="focus-ring mt-4 w-full rounded-2xl border border-wave-deep/15 px-3 py-3"
                  value={form.altTextEn}
                  onChange={(event) => setForm({ ...form, altTextEn: event.target.value })}
                  placeholder={t("admin.gallery.altTextEnPlaceholder")}
                />
              </section>

              <section className="rounded-2xl border border-wave-deep/10 p-4">
                <h3 className="font-black">{t("admin.gallery.altTextZh")}</h3>
                <input
                  aria-label={t("admin.gallery.altTextZh")}
                  className="focus-ring mt-4 w-full rounded-2xl border border-wave-deep/15 px-3 py-3"
                  value={form.altTextZh}
                  onChange={(event) => setForm({ ...form, altTextZh: event.target.value })}
                  placeholder={t("admin.gallery.altTextZhPlaceholder")}
                />
              </section>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-2xl border border-wave-deep/10 px-4 py-3">
              <span>
                <span className="block font-semibold">{t("admin.gallery.activePublicly")}</span>
                <span className="text-sm text-wave-ink/60">{t("admin.gallery.visibleHome")}</span>
              </span>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                className="h-5 w-5"
              />
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-wave-deep/10 bg-white px-5 py-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{label}</p>
        <p className="mt-2 text-2xl font-black">{value}</p>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-wave-mint text-wave-deep">
        {icon}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
