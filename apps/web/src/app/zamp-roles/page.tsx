import { ZampRoleGallery } from "@/components/zamp-role-gallery";

export default function ZampRolesPage() {
  return (
    <main style={{ minHeight: "100dvh", overflow: "hidden", background: "#efefef" }}>
      <section
        style={{
          width: "min(100% - 40px, 780px)",
          margin: "0 auto",
          padding: "96px 0",
        }}
      >
        <ZampRoleGallery />
      </section>
    </main>
  );
}
