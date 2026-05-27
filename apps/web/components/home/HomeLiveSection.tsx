"use client";



import { useMemo, useState } from "react";

import { CamCategorySidebar } from "./CamCategorySidebar";

import { GenderTabs, type GenderTab } from "./GenderTabs";

import { TagBar } from "./TagBar";

import { LiveDirectory } from "./LiveDirectory";



export function HomeLiveSection() {

  const [tab, setTab] = useState<GenderTab>("featured");

  const [tag, setTag] = useState<string | null>(null);



  const tagFromTab = useMemo<string | null>(() => {

    switch (tab) {

      case "female":

        return "female";

      case "male":

        return "male";

      case "couples":

        return "couple";

      case "trans":

        return "trans";

      default:

        return null;

    }

  }, [tab]);



  const activeTag = tag ?? tagFromTab;



  return (

    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">

      <CamCategorySidebar active={tab} onChange={setTab} />

      <div className="flex min-w-0 flex-1 flex-col">

        <div className="lg:hidden">

          <GenderTabs active={tab} onChange={setTab} />

        </div>

        <TagBar active={tag} onChange={setTag} />

        <section className="live-scroll flex-1 overflow-y-auto px-2 py-3 sm:px-3 lg:px-4">

          <LiveDirectory tag={activeTag} />

        </section>

      </div>

    </div>

  );

}

