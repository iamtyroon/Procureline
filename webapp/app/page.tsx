import { DashboardButtons } from "@/app/DashboardButtons";
import { StickyHeader } from "@/components/layout/sticky-header";
import { Link } from "@/components/typography/link";
import { Suspense } from "react";

export default function Home() {
  return (
    <>
      <StickyHeader className="px-4 py-2">
        <div className="flex justify-between items-center">
          <span>SaaS Starter</span>
          <Suspense>
            <DashboardButtons />
          </Suspense>
        </div>
      </StickyHeader>
      <main className="container max-w-2xl flex flex-col gap-8">
        <h1 className="text-4xl font-extrabold my-8 text-center leading-relaxed">
          Procureline - Procurement Planning Platform
        </h1>
        <p>
          Here you{"'"}ll do a great job selling your product through clear
          explanation and clever value proposition...
        </p>
        <hr />
        <p>
          This application includes authentication with{" "}
          <Link href="https://docs.convex.dev/auth" target="_blank">
            Convex Auth
          </Link>
          , and multi-tenant organization management built on{" "}
          <Link href="https://convex.dev" target="_blank">
            Convex
          </Link>{" "}
          with notifications using{" "}
          <Link href="https://resend.com" target="_blank">
            Resend
          </Link>
          .
        </p>
        <p>
          The frontend is powered by{" "}
          <Link href="https://nextjs.org" target="_blank">
            Next.js 16 App Router
          </Link>
          .
        </p>
        <hr />
        <p>
          Check out the{" "}
          <Link href="https://github.com/xixixao/saas-starter" target="_blank">
            project repo
          </Link>{" "}
          for more details.
        </p>
      </main>
    </>
  );
}
