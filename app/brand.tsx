import {Camera, Ribbon} from 'lucide-react';

export default function Brand() {
  return <a className="brand" href="/">
    <Camera aria-hidden="true"/>
    <span>Foto Jakt<small>VENNER OG GRUPPER</small></span>
    <span className="brand-ribbon" role="img" aria-label="Rosa sløyfe" title="Rosa sløyfe · oktober 2026">
      <Ribbon aria-hidden="true"/>
    </span>
  </a>;
}
