'use client';
import {useState} from 'react';
import {SlidersHorizontal} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export default function GalleryFilters({children,active,reset}:any){const [open,setOpen]=useState(false);return <><button className="button compact-filter" onClick={()=>setOpen(true)}><SlidersHorizontal size={16}/>Filter{active>0&&<span className="count-badge">{active}</span>}</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="!max-w-lg max-h-[90dvh] overflow-y-auto"><DialogTitle>Filter</DialogTitle><DialogDescription>Velg hvilke bilder du vil se.</DialogDescription>{children}<div className="actions"><button className="button" onClick={reset}>Nullstill</button><button className="primary" onClick={()=>setOpen(false)}>Vis bilder</button></div></DialogContent></Dialog></>}
