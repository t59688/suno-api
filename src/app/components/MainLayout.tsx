import Header from "./Header";
import Footer from "./Footer";

/**
 * 主站布局组件
 * 包含 Header 和 Footer
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex flex-col items-center m-auto w-full">
        {children}
      </main>
      <Footer />
    </>
  );
}
