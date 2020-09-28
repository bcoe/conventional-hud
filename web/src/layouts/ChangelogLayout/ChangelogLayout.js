import Grid from '@material-ui/core/Grid';

import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
    color: '#fff',
  },
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(2),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

const ChangelogLayout = ({ children }) => {
  const classes = useStyles();

  return (
      <div id="redwood-app">
        <div className={classes.root}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <b>Conventional Commits Heads-up display</b>
          </Grid>
          <Grid item xs={7}>
            <p>
              This tool allows you to automatically generate CHANGELOGs for
              repositories on GitHub following the <a href="https://www.conventionalcommits.org/" target="_blank">Conventional Commits</a> spec.
            </p>
          </Grid>
        </Grid>
      </div>
      {children}
    </div>
  )
}

export default ChangelogLayout
