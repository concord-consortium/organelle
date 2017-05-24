rm -rf dist
git clone -b gh-pages https://github.com/concord-consortium/organelle.git dist
npm run build
cd dist
git add . && git commit -m 'Update gh-pages' && git push origin gh-pages
