/** @type {import('next').NextConfig} */
// Served under www.halimmadi.com/singulars (Saf session 2 consolidation).
// basePath makes every route, asset, and (patched) api string live under
// /singulars, so the halimmadi.com proxy rewrite maps 1:1.
const nextConfig = {
  basePath: "/singulars",
};

export default nextConfig;
